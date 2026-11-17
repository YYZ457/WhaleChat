package app.whalechat.companion.dsexport

import org.junit.Assert.assertEquals
import org.junit.Test

class DsExtractorTest {
    private val W = 1080
    private fun u(t: String, uid: String, start: Boolean = true) = DsExtractor.Line("user", t, 300, uid, start)
    private fun a(t: String, uid: String, x: Int = 60, start: Boolean = false) = DsExtractor.Line("assistant", t, x, uid, start)

    // 完整对话（从上到下）
    private val full = listOf(
        u("今天好累，想听你说晚安", "t1"),
        a("已思考（用时 12 秒）", "t2", 60, true),
        a("她很累，要温柔一点。", "t2", 120),
        a("先安慰，再道晚安。", "t2", 120),
        a("辛苦啦小笨蛋～", "t2"),
        a("1. 先喝口热水", "t2", 100),
        a("2. 早点休息", "t2", 100),
        a("晚安，明天见 🌙", "t2"),
        u("嗯嗯", "t3"),
        a("抱抱你", "t4", 60, true),
        u("嗯嗯", "t5"),
        a("睡吧～", "t6", 60, true),
    )

    @Test fun stitchScreensScrollingUp() {
        // 往上翻：先读到最底部一屏，再读到更早的屏，屏与屏有重叠
        val s1 = full.subList(6, 12)
        val s2 = full.subList(3, 8)
        val s3 = full.subList(0, 5)
        var acc = DsExtractor.stitch(s1, emptyList())
        acc = DsExtractor.stitch(s2, acc)
        acc = DsExtractor.stitch(s3, acc)
        assertEquals(full.map { it.text }, acc.map { it.text })
    }

    @Test fun repeatedShortRepliesNotSwallowed() {
        // 两句一样的「嗯嗯」不能被当成重叠吞掉
        val s1 = full.subList(9, 12)   // 抱抱你 / 嗯嗯 / 睡吧
        val s2 = full.subList(7, 10)   // 晚安 / 嗯嗯 / 抱抱你
        val acc = DsExtractor.stitch(s2, DsExtractor.stitch(s1, emptyList()))
        assertEquals(listOf("晚安，明天见 🌙", "嗯嗯", "抱抱你", "嗯嗯", "睡吧～"), acc.map { it.text })
    }

    @Test fun splitThinkingFromAnswer() {
        val turns = DsExtractor.buildTurns(full, W)
        assertEquals(listOf("user", "assistant", "user", "assistant", "user", "assistant"), turns.map { it.role })
        val t = turns[1]
        assertEquals("她很累，要温柔一点。\n\n先安慰，再道晚安。", t.reasoning)
        assertEquals("辛苦啦小笨蛋～\n\n1. 先喝口热水\n\n2. 早点休息\n\n晚安，明天见 🌙", t.content)
        assertEquals(12.0, t.thinkSecs!!, 0.0)
    }

    @Test fun collapsedThinkingHasNoReasoning() {
        val lines = listOf(u("在吗", "t1"), a("已深度思考（用时 3 秒）", "t2", 60, true), a("在的～", "t2"))
        val t = DsExtractor.buildTurns(lines, W)[1]
        assertEquals("", t.reasoning)
        assertEquals("在的～", t.content)
    }

    @Test fun turnSplitAcrossScreensIsMerged() {
        // 同一条回答跨两屏，后一屏的首行也被标成 isTurnStart，应合并成一条
        val lines = listOf(u("讲个故事", "s1_t0"), a("从前有座山", "s1_t1", 60, true), a("山里有座庙", "s0_t0", 60, true))
        val turns = DsExtractor.buildTurns(lines, W)
        assertEquals(2, turns.size)
        assertEquals("从前有座山\n\n山里有座庙", turns[1].content)
    }
}
