package app.whalechat.companion.dsexport

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.math.abs

/**
 * 从 DeepSeek App 的界面树中读取一屏对话，并把多屏结果拼接、整理成完整对话。
 * 思路参考自用户提供的 chat-exporter 核心模块，针对 DeepSeek 做了增强：
 * - 记录每行的横坐标，用于把「深度思考」正文（有缩进）与回答分开；
 * - 不再有屏数上限，靠「连续几屏不变」判断到顶。
 */
internal object DsExtractor {

    const val DEEPSEEK_PKG = "com.deepseek.chat"

    data class Line(
        val role: String,      // user / assistant / unknown
        val text: String,
        val x: Int,            // 行首横坐标
        val turnUid: String,
        val isTurnStart: Boolean,
    )

    data class Turn(
        val role: String,
        val content: String,
        val reasoning: String,
        val thinkSecs: Double?,
    )

    private val ASSISTANT_DESCS = setOf("复制", "喜欢", "不喜欢", "朗读", "分享", "重新生成", "点赞", "点踩")
    val THINK_HEADER = Regex("^已(?:深度)?思考\\s*[（(]\\s*用时\\s*([\\d.]+)\\s*秒\\s*[)）]$")
    private val IGNORE_DESC = listOf(
        Regex("^引用\\s*\\d+$"), Regex("^复制$"), Regex("^喜欢$"), Regex("^不喜欢$"), Regex("^点赞$"), Regex("^点踩$"),
        Regex("^朗读$"), Regex("^分享$"), Regex("^重新生成$"), Regex("^展开$"), Regex("^收起$"), Regex("^编辑$"),
        Regex("^打开侧边栏$"), Regex("^自动朗读$"), Regex("^开启新对话$"), Regex("^上传文件$"), Regex("^切换至语音$"),
    )
    private val IGNORE_TEXT = listOf(
        Regex("^\\d+\\s*个网页$"),
        Regex("^已(?:搜索到|阅读|浏览)\\s*\\d+\\s*个网页.*$"),
        Regex("^找到\\s*\\d+\\s*篇资料.*$"),
        Regex("^回答由\\s*AI\\s*生成.*$"),
        Regex("^内容由\\s*AI\\s*生成.*$"),
        Regex("^复制$"),
    )

    private data class Item(val x1: Int, val y1: Int, val x2: Int, val text: String)

    /** 主对话列表：面积最大的可滚动节点 */
    fun findList(root: AccessibilityNodeInfo, w: Int, h: Int): AccessibilityNodeInfo? {
        val minArea = w.toLong() * h / 4
        var best: AccessibilityNodeInfo? = null
        var bestArea = -1L
        val q = ArrayDeque<AccessibilityNodeInfo>()
        q.add(root)
        var visited = 0
        while (q.isNotEmpty() && visited < 6000) {
            val n = q.removeFirst(); visited++
            if (n.isScrollable && n.isVisibleToUser) {
                val r = Rect(); n.getBoundsInScreen(r)
                val area = r.width().coerceAtLeast(0).toLong() * r.height().coerceAtLeast(0)
                if (area >= minArea && area > bestArea) { bestArea = area; best = n }
            }
            for (i in 0 until n.childCount) n.getChild(i)?.let { q.add(it) }
        }
        return best
    }

    fun detectTitle(root: AccessibilityNodeInfo, h: Int, list: AccessibilityNodeInfo?): String {
        val maxY = (h * 0.12f).toInt()
        val found = ArrayList<Pair<Int, String>>()
        fun walk(n: AccessibilityNodeInfo, depth: Int) {
            if (depth > 40) return
            if (list != null && n == list) return
            if (n.isVisibleToUser) {
                val t = n.text?.toString()?.trim().orEmpty()
                if (t.isNotEmpty()) {
                    val r = Rect(); n.getBoundsInScreen(r)
                    if (r.bottom in 1..maxY) found.add(r.left to t)
                }
            }
            for (i in 0 until n.childCount) n.getChild(i)?.let { walk(it, depth + 1) }
        }
        walk(root, 0)
        return found.maxByOrNull { it.second.length }?.second.orEmpty()
    }

    /** 读取当前屏幕可见的对话行 */
    fun readScreen(root: AccessibilityNodeInfo, w: Int, h: Int, screen: Int): List<Line> {
        val list = findList(root, w, h) ?: return emptyList()
        val listRect = Rect(); list.getBoundsInScreen(listRect)
        val botCut = listRect.bottom - (h * 0.01f).toInt()
        val turns = ArrayList<Pair<Int, AccessibilityNodeInfo>>()
        for (i in 0 until list.childCount) {
            val c = list.getChild(i) ?: continue
            if (!c.isVisibleToUser) continue
            val r = Rect(); c.getBoundsInScreen(r)
            turns.add(r.top to c)
        }
        turns.sortBy { it.first }
        val out = ArrayList<Line>()
        turns.forEachIndexed { ti, (_, node) ->
            val role = classify(node, w)
            val items = ArrayList<Item>()
            collect(node, botCut, items, 0)
            items.sortWith(compareBy({ it.y1 / 24 }, { it.x1 }))
            val merged = ArrayList<Item>()
            for (it in items) {
                val last = merged.lastOrNull()
                if (last != null && abs(it.y1 - last.y1) <= 20 && it.x1 >= last.x2 - 8) {
                    merged[merged.lastIndex] = Item(last.x1, last.y1, it.x2, last.text + " " + it.text)
                } else merged.add(it)
            }
            val uid = "s${screen}_t$ti"
            merged.forEachIndexed { pos, it -> out.add(Line(role, it.text, it.x1, uid, pos == 0)) }
        }
        return out
    }

    private fun classify(turn: AccessibilityNodeInfo, w: Int): String {
        var marker = false
        var minX = w
        var maxX = 0
        val q = ArrayDeque<AccessibilityNodeInfo>()
        q.add(turn)
        var visited = 0
        while (q.isNotEmpty() && visited < 3000) {
            val n = q.removeFirst(); visited++
            val desc = n.contentDescription?.toString()?.trim().orEmpty()
            val text = n.text?.toString()?.trim().orEmpty()
            if (desc in ASSISTANT_DESCS || THINK_HEADER.matches(text)) marker = true
            if (text.isNotEmpty() && n.isVisibleToUser) {
                val r = Rect(); n.getBoundsInScreen(r)
                if (r.width() > 0) { minX = minOf(minX, r.left); maxX = maxOf(maxX, r.right) }
            }
            for (i in 0 until n.childCount) n.getChild(i)?.let { q.add(it) }
        }
        if (marker) return "assistant"
        if (minX >= (w * 0.15f).toInt() && maxX >= (w * 0.85f).toInt()) return "user"
        if (minX < (w * 0.15f).toInt()) return "assistant"
        return "unknown"
    }

    private fun collect(n: AccessibilityNodeInfo, botCut: Int, out: MutableList<Item>, depth: Int) {
        if (depth > 60 || !n.isVisibleToUser) return
        val desc = n.contentDescription?.toString()?.trim().orEmpty()
        val text = n.text?.toString()?.replace("�", "")?.trim().orEmpty()
        val ignored = (desc.isNotEmpty() && IGNORE_DESC.any { it.matches(desc) }) ||
            (text.isNotEmpty() && IGNORE_TEXT.any { it.matches(text) })
        if (!ignored && text.isNotEmpty()) {
            val r = Rect(); n.getBoundsInScreen(r)
            if (r.top < botCut) out.add(Item(r.left, r.top, r.right, text))
        }
        for (i in 0 until n.childCount) n.getChild(i)?.let { collect(it, botCut, out, depth + 1) }
    }

    /** 屏幕签名：判断是否滚动到头 */
    fun signature(lines: List<Line>): List<String> = lines.map { it.text }

    /** 往上翻时，新读到的屏（更早的内容）拼到已有内容前面，去掉重叠部分 */
    fun stitch(earlier: List<Line>, later: List<Line>): List<Line> {
        if (earlier.isEmpty()) return later
        if (later.isEmpty()) return earlier
        fun overlapOf(e: List<Line>, l: List<Line>): Int {
            val maxK = minOf(e.size, l.size)
            for (k in maxK downTo 1) {
                var ok = true
                for (i in 0 until k) if (e[e.size - k + i].text != l[i].text) { ok = false; break }
                if (ok) return k
            }
            return 0
        }
        val k = overlapOf(earlier, later)
        if (k > 0) return earlier + later.subList(k, later.size)
        // 边缘行可能被截断：容忍首尾各一行不一致
        for (te in 0..1) for (tl in 0..1) {
            if (te == 0 && tl == 0) continue
            if (earlier.size <= te || later.size <= tl) continue
            val e = earlier.subList(0, earlier.size - te)
            val l = later.subList(tl, later.size)
            val kk = overlapOf(e, l)
            if (kk > 0) return e + l.subList(kk, l.size)
        }
        return earlier + later
    }

    /** 整理成轮次，并把深度思考正文从回答中分离 */
    fun buildTurns(lines: List<Line>, screenWidth: Int): List<Turn> {
        // 1. 按轮分组
        data class G(val role: String, val lines: MutableList<Line>, var uid: String)
        val groups = ArrayList<G>()
        for (l in lines) {
            val last = groups.lastOrNull()
            if (last != null && (l.turnUid == last.uid || (!l.isTurnStart && l.role == last.role))) {
                last.lines.add(l); last.uid = l.turnUid
            } else groups.add(G(l.role, mutableListOf(l), l.turnUid))
        }
        // 2. unknown 角色按交替推断；相邻同角色合并
        val merged = ArrayList<G>()
        for (g in groups) {
            val role = when (g.role) {
                "user", "assistant" -> g.role
                else -> if (merged.lastOrNull()?.role == "user") "assistant" else "user"
            }
            val last = merged.lastOrNull()
            if (last != null && last.role == role) last.lines.addAll(g.lines)
            else merged.add(G(role, g.lines.toMutableList(), g.uid))
        }
        // 3. 拆分思考
        val indent = maxOf(16, (screenWidth * 0.03f).toInt())
        return merged.map { g ->
            if (g.role != "assistant") return@map Turn("user", g.lines.joinToString("\n") { it.text }.trim(), "", null)
            val think = StringBuilder()
            val resp = StringBuilder()
            var secs: Double? = null
            var base = -1
            var inThink = false
            for (l in g.lines) {
                val m = THINK_HEADER.matchEntire(l.text)
                if (m != null) {
                    secs = m.groupValues[1].toDoubleOrNull()
                    base = l.x; inThink = true
                    continue
                }
                if (inThink && l.x > base + indent) {
                    if (think.isNotEmpty()) think.append("\n\n")
                    think.append(l.text)
                    continue
                }
                inThink = false
                if (resp.isNotEmpty()) resp.append("\n\n")
                resp.append(l.text)
            }
            Turn("assistant", resp.toString().trim(), think.toString().trim(), secs)
        }.filter { it.content.isNotEmpty() || it.reasoning.isNotEmpty() }
    }
}
