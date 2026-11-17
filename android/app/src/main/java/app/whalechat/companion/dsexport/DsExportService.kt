package app.whalechat.companion.dsexport

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * 鲸语导出助手（无障碍服务）
 * - 只在用户从鲸语里点了「开始导入」后才出现悬浮面板，且只在 DeepSeek App 前台时显示；
 * - 只读取 DeepSeek App（com.deepseek.chat）的界面内容，读到的文字只保存在本机；
 * - 不联网，不读取其他 App。
 */
class DsExportService : AccessibilityService() {

    companion object {
        @Volatile var instance: DsExportService? = null
        /** 导出完成回调（鲸语插件监听） */
        @Volatile var onExported: ((String) -> Unit)? = null
    }

    private val handler = Handler(Looper.getMainLooper())
    private var panel: Panel? = null
    private var running = false
    private var gen = 0L
    private var imePkgs: Set<String> = emptySet()

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        panel = Panel(this)
        imePkgs = runCatching {
            (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).enabledInputMethodList.map { it.packageName }.toSet()
        }.getOrDefault(emptySet())
        if (DsStore.isArmed(this) && foregroundPkg() == DsExtractor.DEEPSEEK_PKG) panel?.showIdle()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        val cls = event.className?.toString().orEmpty()
        when {
            pkg == DsExtractor.DEEPSEEK_PKG -> if (DsStore.isArmed(this)) panel?.showIfHidden()
            pkg == packageName -> if (cls.startsWith(packageName) && !running) panel?.hide()
            pkg == "com.android.systemui" || pkg in imePkgs -> Unit
            else -> if (!running) panel?.hide()
        }
    }

    override fun onInterrupt() { cancel() }

    override fun onDestroy() {
        cancel()
        panel?.hide()
        panel = null
        if (instance === this) instance = null
        super.onDestroy()
    }

    /** 鲸语点了「开始导入」 */
    fun onArmed() { handler.post { if (foregroundPkg() == DsExtractor.DEEPSEEK_PKG) panel?.showIdle() } }

    fun onDisarmed() { handler.post { if (!running) panel?.hide() } }

    private fun foregroundPkg(): String? = rootInActiveWindow?.packageName?.toString()

    /** 只返回 DeepSeek 的界面根节点 */
    private fun deepseekRoot(): AccessibilityNodeInfo? {
        rootInActiveWindow?.let { if (it.packageName?.toString() == DsExtractor.DEEPSEEK_PKG) return it }
        return windows?.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
            ?.mapNotNull { it.root }
            ?.firstOrNull { it.packageName?.toString() == DsExtractor.DEEPSEEK_PKG }
    }

    // ---------------- 导出流程 ----------------

    fun start() {
        handler.post {
            if (running) return@post
            val root = deepseekRoot()
            val dm = resources.displayMetrics
            if (root == null) { panel?.showError("请先在 DeepSeek 里打开想导出的那段对话"); return@post }
            if (DsExtractor.findList(root, dm.widthPixels, dm.heightPixels) == null) {
                panel?.showError("没有找到聊天内容，请先打开一段对话"); return@post
            }
            running = true
            gen++
            panel?.showRunning("正在定位到最新消息…", "请不要触碰屏幕")
            toBottom(gen, 0, null, 0)
        }
    }

    fun cancel() {
        handler.post {
            if (!running) return@post
            running = false
            gen++
            handler.removeCallbacksAndMessages(null)
            panel?.showIdle("已停止。可以重新开始")
        }
    }

    /** 第一步：滑到最底部，保证不漏掉最新的消息 */
    private fun toBottom(g: Long, step: Int, prevSig: List<String>?, same: Int) {
        if (!running || g != gen) return
        val root = deepseekRoot() ?: return fail("DeepSeek 界面已离开，导出中止")
        val dm = resources.displayMetrics
        val sig = DsExtractor.signature(DsExtractor.readScreen(root, dm.widthPixels, dm.heightPixels, -1))
        val nSame = if (sig == prevSig) same + 1 else 0
        if (nSame >= 2 || step > 300) {
            handler.postDelayed({ read(g, 0, "", emptyList(), null, 0) }, 400)
            return
        }
        swipe(dm.widthPixels * 0.5f, dm.heightPixels * 0.72f, dm.heightPixels * 0.28f, 260L) {
            handler.postDelayed({ toBottom(g, step + 1, sig, nSame) }, 380)
        }
    }

    /** 第二步：一屏一屏往上读，直到连续几屏都没变化（到顶） */
    private fun read(g: Long, step: Int, title: String, acc: List<DsExtractor.Line>, prevSig: List<String>?, same: Int) {
        if (!running || g != gen) return
        val root = deepseekRoot() ?: return finish(title, acc)
        val dm = resources.displayMetrics
        val w = dm.widthPixels
        val h = dm.heightPixels
        val lines = DsExtractor.readScreen(root, w, h, step)
        val t = title.ifBlank { DsExtractor.detectTitle(root, h, DsExtractor.findList(root, w, h)) }
        val sig = DsExtractor.signature(lines)
        val unchanged = prevSig != null && sig == prevSig
        val nSame = if (unchanged) same + 1 else 0
        val nextAcc = if (unchanged) acc else DsExtractor.stitch(lines, acc)
        panel?.showRunning("正在读取第 ${step + 1} 屏…", "已读到 ${nextAcc.size} 行 · 请不要触碰屏幕")
        if (nSame >= 3 || step >= 6000) return finish(t, nextAcc)
        swipe(w * 0.5f, h * 0.30f, h * 0.76f, 420L) {
            // 没变化时多等一会儿：可能正在加载更早的消息
            handler.postDelayed({ read(g, step + 1, t, nextAcc, sig, nSame) }, if (unchanged) 1200L else 650L)
        }
    }

    private fun finish(title: String, acc: List<DsExtractor.Line>) {
        running = false
        val turns = DsExtractor.buildTurns(acc, resources.displayMetrics.widthPixels)
        if (turns.isEmpty()) { panel?.showError("没有读到聊天内容"); return }
        val name = title.trim().ifBlank { turns.firstOrNull { it.role == "user" }?.content?.take(18) ?: "DeepSeek 对话" }
        val id = DsStore.save(this, name, turns)
        panel?.showDone(turns.size, name)
        onExported?.invoke(id)
    }

    private fun fail(msg: String) { running = false; panel?.showError(msg) }

    private fun swipe(x: Float, y1: Float, y2: Float, dur: Long, done: () -> Unit) {
        val path = Path().apply { moveTo(x, y1); lineTo(x, y2) }
        val gesture = GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path, 0L, dur)).build()
        val ok = dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(d: GestureDescription?) = done()
            override fun onCancelled(d: GestureDescription?) = done()
        }, handler)
        if (!ok) done()
    }

    fun backToWhale() {
        DsStore.setArmed(this, false)
        panel?.hide()
        packageManager.getLaunchIntentForPackage(packageName)?.let {
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            startActivity(it)
        }
    }

    fun closePanel() {
        DsStore.setArmed(this, false)
        cancel()
        panel?.hide()
    }

    // ---------------- 悬浮面板 ----------------

    private class Panel(val svc: DsExportService) {
        private val wm = svc.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        private val dp = svc.resources.displayMetrics.density
        private fun px(v: Int) = (v * dp).toInt()
        private var root: LinearLayout? = null
        private lateinit var title: TextView
        private lateinit var sub: TextView
        private lateinit var row: LinearLayout
        private var params: WindowManager.LayoutParams? = null
        private var state: () -> Unit = { showIdle() }

        private val blue = Color.parseColor("#4D6BFE")

        @SuppressLint("ClickableViewAccessibility")
        private fun ensure() {
            if (root != null) return
            val box = LinearLayout(svc).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(px(14), px(12), px(14), px(12))
                background = GradientDrawable().apply {
                    setColor(Color.WHITE); cornerRadius = px(18).toFloat()
                    setStroke(px(1), Color.parseColor("#1F000000"))
                }
                elevation = px(8).toFloat()
            }
            title = TextView(svc).apply { textSize = 15f; setTextColor(Color.parseColor("#111111")); typeface = Typeface.DEFAULT_BOLD }
            sub = TextView(svc).apply { textSize = 12.5f; setTextColor(Color.parseColor("#6B6F76")); setPadding(0, px(3), 0, 0); maxWidth = px(220) }
            row = LinearLayout(svc).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, px(10), 0, 0) }
            box.addView(title); box.addView(sub); box.addView(row)

            val lp = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT,
            ).apply { gravity = Gravity.TOP or Gravity.END; x = px(12); y = (svc.resources.displayMetrics.heightPixels * 0.16f).toInt() }

            // 拖动标题移动面板
            var dy = 0f; var sy = 0
            title.setOnTouchListener { _, e ->
                when (e.action) {
                    MotionEvent.ACTION_DOWN -> { dy = e.rawY; sy = lp.y; true }
                    MotionEvent.ACTION_MOVE -> { if (abs(e.rawY - dy) > 6) { lp.y = (sy + (e.rawY - dy)).toInt().coerceAtLeast(0); runCatching { wm.updateViewLayout(box, lp) } }; true }
                    else -> true
                }
            }
            root = box; params = lp
        }

        private fun attach() {
            ensure()
            val r = root!!
            if (r.parent == null) runCatching { wm.addView(r, params) }
        }

        private fun btn(label: String, primary: Boolean, onClick: () -> Unit) = TextView(svc).apply {
            text = label; textSize = 14f; gravity = Gravity.CENTER
            setTextColor(if (primary) Color.WHITE else Color.parseColor("#333333"))
            setPadding(px(14), px(8), px(14), px(8))
            background = GradientDrawable().apply { setColor(if (primary) blue else Color.parseColor("#F1F2F4")); cornerRadius = px(16).toFloat() }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { marginEnd = px(8) }
            setOnClickListener { onClick() }
        }

        private fun render(t: String, s: String, vararg buttons: TextView) {
            attach()
            title.text = t; sub.text = s
            sub.visibility = if (s.isEmpty()) View.GONE else View.VISIBLE
            row.removeAllViews(); buttons.forEach { row.addView(it) }
            row.visibility = if (buttons.isEmpty()) View.GONE else View.VISIBLE
        }

        fun showIfHidden() { if (root?.parent == null) state() }

        fun showIdle(hint: String = "打开想导入的对话，然后点「导出」") {
            state = { showIdle(hint) }
            render("鲸语 · 导入助手", hint, btn("导出这段对话", true) { svc.start() }, btn("关闭", false) { svc.closePanel() })
        }

        fun showRunning(t: String, s: String) {
            state = { showRunning(t, s) }
            render(t, s, btn("停止", false) { svc.cancel() })
        }

        fun showDone(n: Int, name: String) {
            state = { showDone(n, name) }
            render("✓ 已读取 $n 条消息", "「${name.take(16)}」", btn("回到鲸语", true) { svc.backToWhale() }, btn("再导一段", false) { showIdle("打开下一段对话，然后点「导出」") })
        }

        fun showError(msg: String) {
            state = { showError(msg) }
            render("没能导出", msg, btn("重试", true) { svc.start() }, btn("关闭", false) { svc.closePanel() })
        }

        fun hide() {
            root?.let { if (it.parent != null) runCatching { wm.removeView(it) } }
        }
    }
}
