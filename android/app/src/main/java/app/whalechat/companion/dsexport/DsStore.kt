package app.whalechat.companion.dsexport

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** 导出结果暂存在 App 私有目录，等鲸语界面回到前台后取走 */
internal object DsStore {
    private const val PREFS = "ds_export"

    private fun dir(ctx: Context) = File(ctx.filesDir, "ds_exports").apply { mkdirs() }

    fun save(ctx: Context, title: String, turns: List<DsExtractor.Turn>): String {
        val id = System.currentTimeMillis().toString()
        val arr = JSONArray()
        for (t in turns) {
            arr.put(JSONObject().apply {
                put("role", t.role)
                put("content", t.content)
                if (t.reasoning.isNotEmpty()) put("reasoning", t.reasoning)
                if (t.thinkSecs != null) put("thinkSecs", t.thinkSecs)
            })
        }
        val obj = JSONObject()
            .put("id", id)
            .put("title", title)
            .put("exportedAt", System.currentTimeMillis())
            .put("source", "deepseek-app")
            .put("turns", arr)
        File(dir(ctx), "$id.json").writeText(obj.toString(), Charsets.UTF_8)
        return id
    }

    fun list(ctx: Context): JSONArray {
        val out = JSONArray()
        dir(ctx).listFiles { f -> f.name.endsWith(".json") }?.sortedBy { it.name }?.forEach { f ->
            runCatching { out.put(JSONObject(f.readText(Charsets.UTF_8))) }
        }
        return out
    }

    fun delete(ctx: Context, ids: List<String>) {
        ids.forEach { id -> File(dir(ctx), "${id.replace(Regex("[^0-9]"), "")}.json").delete() }
    }

    fun count(ctx: Context): Int = dir(ctx).listFiles { f -> f.name.endsWith(".json") }?.size ?: 0

    fun isArmed(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("armed", false)
    fun setArmed(ctx: Context, v: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("armed", v).apply()
    }
}
