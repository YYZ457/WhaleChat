package app.whalechat.companion.dsexport

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import androidx.activity.result.ActivityResult
import android.app.Activity
import java.io.File

/** 鲸语 ↔ 导出助手 的桥接 */
@CapacitorPlugin(name = "DeepSeekImport")
class DeepSeekImportPlugin : Plugin() {

    override fun load() {
        DsExportService.onExported = { id ->
            bridge?.activity?.runOnUiThread { notifyListeners("exported", JSObject().put("id", id)) }
        }
    }

    private fun serviceEnabled(): Boolean {
        if (DsExportService.instance != null) return true
        val ctx = context
        val expected = ComponentName(ctx, DsExportService::class.java).flattenToString()
        if (Settings.Secure.getInt(ctx.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED, 0) != 1) return false
        val value = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val sp = TextUtils.SimpleStringSplitter(':'); sp.setString(value)
        while (sp.hasNext()) if (sp.next().equals(expected, ignoreCase = true)) return true
        return false
    }

    private fun deepseekInstalled() = context.packageManager.getLaunchIntentForPackage(DsExtractor.DEEPSEEK_PKG) != null

    @PluginMethod
    fun status(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("serviceEnabled", serviceEnabled())
            put("serviceRunning", DsExportService.instance != null)
            put("deepseekInstalled", deepseekInstalled())
            put("armed", DsStore.isArmed(context))
            put("pending", DsStore.count(context))
            put("sdk", Build.VERSION.SDK_INT)
        })
    }

    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        val comp = ComponentName(context, DsExportService::class.java)
        val tries = mutableListOf<Intent>()
        if (Build.VERSION.SDK_INT >= 33) {
            tries.add(Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS").putExtra(Intent.EXTRA_COMPONENT_NAME, comp.flattenToString()))
        }
        tries.add(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        for (i in tries) {
            try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(i); call.resolve(); return } catch (_: Exception) {}
        }
        call.reject("无法打开无障碍设置")
    }

    @PluginMethod
    fun openAppDetails(call: PluginCall) {
        val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(i)
        call.resolve()
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (!serviceEnabled()) { call.reject("SERVICE_DISABLED"); return }
        val launch = context.packageManager.getLaunchIntentForPackage(DsExtractor.DEEPSEEK_PKG)
        if (launch == null) { call.reject("DEEPSEEK_NOT_INSTALLED"); return }
        DsStore.setArmed(context, true)
        DsExportService.instance?.onArmed()
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launch)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        DsStore.setArmed(context, false)
        DsExportService.instance?.onDisarmed()
        call.resolve()
    }

    @PluginMethod
    fun getPending(call: PluginCall) {
        val arr = DsStore.list(context)
        val js = JSArray()
        for (i in 0 until arr.length()) js.put(arr.get(i))
        call.resolve(JSObject().put("items", js))
    }

    @PluginMethod
    fun clearPending(call: PluginCall) {
        val ids = call.getArray("ids")?.toList<String>() ?: emptyList()
        DsStore.delete(context, ids)
        call.resolve()
    }

    /** 打开内置浏览器，登录网页版后导出，返回接到的文件路径 */
    @PluginMethod
    fun openWebExport(call: PluginCall) {
        startActivityForResult(call, Intent(context, WebExportActivity::class.java), "webExportResult")
    }

    @ActivityCallback
    fun webExportResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val path = result.data?.getStringExtra(WebExportActivity.EXTRA_PATH)
        if (result.resultCode != Activity.RESULT_OK || path == null) { call.resolve(JSObject().put("cancelled", true)); return }
        val f = File(path)
        call.resolve(JSObject().put("path", path).put("name", result.data?.getStringExtra(WebExportActivity.EXTRA_NAME) ?: f.name).put("size", f.length()))
    }

    @PluginMethod
    fun deleteFile(call: PluginCall) {
        val path = call.getString("path") ?: return call.resolve()
        val f = File(path)
        if (f.canonicalPath.startsWith(context.cacheDir.canonicalPath)) f.delete()
        call.resolve()
    }
}
