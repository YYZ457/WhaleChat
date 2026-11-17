package app.whalechat.companion.dsexport

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * 内置浏览器：用户在这里登录 DeepSeek 网页版，点「导出所有历史对话」，
 * 下载的 zip 会被直接接住交给鲸语导入，不用去文件管理器里找。
 * 只允许打开 deepseek.com 的页面；退出时清除登录信息。
 */
class WebExportActivity : Activity() {

    companion object {
        const val START_URL = "https://chat.deepseek.com/"
        const val EXTRA_PATH = "path"
        const val EXTRA_NAME = "name"
        private val ALLOWED_HOST = Regex("(^|\\.)deepseek\\.com$")
    }

    private lateinit var web: WebView
    private lateinit var tip: TextView
    private lateinit var bar: ProgressBar
    private var desktop = false
    private var out: FileOutputStream? = null
    private var outFile: File? = null
    private var done = false
    @Volatile private var pageHost = ""
    private fun trusted() = ALLOWED_HOST.containsMatchIn(pageHost)

    private val dp by lazy { resources.displayMetrics.density }
    private fun px(v: Int) = (v * dp).toInt()

    // 在网页加载前注入：记住 blob 对象，拦截带 download 属性的链接点击，直接把文件内容交给原生
    private val HOOK_JS = """
        (function(){
          if (window.__whaleHook) return; window.__whaleHook = 1;
          var blobs = {};
          var oc = URL.createObjectURL;
          URL.createObjectURL = function(b){ var u = oc.apply(URL, arguments); try { blobs[u] = b; } catch(e){} return u; };
          function send(blob, name){
            if (!window.WhaleExport) return false;
            WhaleExport.begin(name || 'deepseek_data.zip', blob.type || '');
            var size = 768 * 1024, off = 0;
            function next(){
              if (off >= blob.size) { WhaleExport.end(); return; }
              var r = new FileReader();
              r.onload = function(){ var s = r.result; WhaleExport.chunk(s.substring(s.indexOf(',') + 1)); off += size; next(); };
              r.onerror = function(){ WhaleExport.fail('读取文件失败'); };
              r.readAsDataURL(blob.slice(off, off + size));
            }
            next(); return true;
          }
          function grab(a){
            var href = a && a.href || '';
            if (href.indexOf('blob:') === 0 && blobs[href]) return send(blobs[href], a.download || a.getAttribute('download'));
            if (href.indexOf('data:') === 0) { fetch(href).then(function(r){ return r.blob(); }).then(function(b){ send(b, a.download); }); return true; }
            return false;
          }
          var ac = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function(){ if (this.hasAttribute('download') && grab(this)) return; return ac.apply(this, arguments); };
          document.addEventListener('click', function(e){
            var a = e.target && e.target.closest && e.target.closest('a[download]');
            if (a && grab(a)) { e.preventDefault(); e.stopPropagation(); }
          }, true);
          window.__whaleFetchBlob = function(u, name){
            if (blobs[u]) return send(blobs[u], name);
            fetch(u).then(function(r){ return r.blob(); }).then(function(b){ send(b, name); }).catch(function(){ WhaleExport.fail('文件已失效，请再点一次导出'); });
          };
        })();
    """.trimIndent()

    inner class Bridge {
        @JavascriptInterface fun begin(name: String, mime: String) {
            if (!trusted()) return
            runCatching { out?.close() }
            val safe = name.replace(Regex("[^\\w.\\-\\u4e00-\\u9fa5]"), "_").ifBlank { "deepseek_data.zip" }
            outFile = File(cacheDir, "web_export_${System.currentTimeMillis()}_$safe")
            out = FileOutputStream(outFile!!)
            runOnUiThread { showTip("正在接收导出文件…", true) }
        }
        @JavascriptInterface fun chunk(b64: String) { if (!trusted()) return; runCatching { out?.write(Base64.decode(b64, Base64.DEFAULT)) } }
        @JavascriptInterface fun end() {
            if (!trusted()) return
            runCatching { out?.close() }; out = null
            outFile?.let { f -> runOnUiThread { deliver(f) } }
        }
        @JavascriptInterface fun fail(msg: String) { runOnUiThread { showTip(msg, false) } }
    }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.WHITE

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE); fitsSystemWindows = true }

        // 顶栏
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(px(6), px(6), px(10), px(6)) }
        val close = TextView(this).apply { text = "✕"; textSize = 20f; setTextColor(Color.parseColor("#111111")); setPadding(px(12), px(6), px(12), px(6)); setOnClickListener { cancelAndFinish() } }
        val title = TextView(this).apply { text = "从网页版导出"; textSize = 17f; typeface = Typeface.DEFAULT_BOLD; setTextColor(Color.parseColor("#111111")); layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f) }
        val mode = TextView(this).apply {
            text = "电脑版页面"; textSize = 13f; setTextColor(Color.parseColor("#4D6BFE")); setPadding(px(10), px(6), px(10), px(6))
            setOnClickListener { desktop = !desktop; text = if (desktop) "手机版页面" else "电脑版页面"; applyUa(); web.reload() }
        }
        top.addView(close); top.addView(title); top.addView(mode)

        tip = TextView(this).apply {
            textSize = 13.5f; setTextColor(Color.parseColor("#2B3A67")); setLineSpacing(0f, 1.3f)
            setPadding(px(14), px(10), px(14), px(10))
            background = GradientDrawable().apply { setColor(Color.parseColor("#EEF3FF")); cornerRadius = px(12).toFloat() }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(px(12), 0, px(12), px(8)) }
        }
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100; layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(3))
        }

        web = WebView(this)
        web.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        val st = web.settings
        st.javaScriptEnabled = true
        st.domStorageEnabled = true
        st.databaseEnabled = true
        st.loadWithOverviewMode = true
        st.useWideViewPort = true
        st.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        applyUa()
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
        web.addJavascriptInterface(Bridge(), "WhaleExport")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, HOOK_JS, setOf("https://chat.deepseek.com", "https://*.deepseek.com"))
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.scheme == "http" || u.scheme == "https") return false  // 含第三方登录页

                // weixin:// 等外部协议：交给系统
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                pageHost = runCatching { Uri.parse(url).host.orEmpty() }.getOrDefault("")
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(HOOK_JS, null)
            }
            override fun onPageFinished(view: WebView, url: String?) {
                view.evaluateJavascript(HOOK_JS, null)
                updateTipFor(url.orEmpty())
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, p: Int) { bar.progress = p; bar.visibility = if (p >= 100) View.GONE else View.VISIBLE }
        }
        web.setDownloadListener { url, ua, disposition, mime, _ ->
            if (!trusted()) { showTip("只接收来自 DeepSeek 的导出文件", false); return@setDownloadListener }
            val name = URLUtil.guessFileName(url, disposition, mime).let { if (it.endsWith(".bin")) "deepseek_data.zip" else it }
            when {
                url.startsWith("blob:") -> web.evaluateJavascript("window.__whaleFetchBlob && window.__whaleFetchBlob(${jsStr(url)}, ${jsStr(name)})", null)
                url.startsWith("data:") -> thread { saveData(url, name) }
                else -> thread { download(url, ua, name) }
            }
        }

        val frame = FrameLayout(this).apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f) }
        frame.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(top); root.addView(tip); root.addView(bar); root.addView(frame)
        setContentView(root)
        showTip("① 先登录你原来的 DeepSeek 账号\n② 登录后点左下角头像 → 设置 → 数据管理 → 导出所有历史对话\n③ 下载会被鲸语自动接住，不用去找文件", false)
        web.loadUrl(START_URL)
    }

    private fun jsStr(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    private fun applyUa() {
        val base = WebSettings.getDefaultUserAgent(this)
        web.settings.userAgentString = if (desktop)
            base.replace(Regex("\\(Linux; Android[^)]*\\)"), "(Windows NT 10.0; Win64; x64)").replace(" Mobile", "").replace("; wv", "")
        else base.replace("; wv", "")
    }

    private fun updateTipFor(url: String) {
        if (done) return
        val loggedIn = url.contains("chat.deepseek.com") && !url.contains("sign_in") && !url.contains("login")
        if (loggedIn) showTip("已登录 ✓\n点左下角头像（或「···」）→ 设置 → 数据管理 → 导出所有历史对话。\n找不到的话，点右上角切换「电脑版页面」试试。", false)
    }

    private fun showTip(msg: String, busy: Boolean) { tip.text = msg; if (busy) bar.visibility = View.VISIBLE }

    private fun saveData(url: String, name: String) {
        runCatching {
            val b64 = url.substringAfter(",")
            val f = File(cacheDir, "web_export_${System.currentTimeMillis()}_$name")
            f.writeBytes(Base64.decode(b64, Base64.DEFAULT))
            runOnUiThread { deliver(f) }
        }.onFailure { runOnUiThread { showTip("接收文件失败：${it.message}", false) } }
    }

    private fun download(url: String, ua: String?, name: String) {
        runOnUiThread { showTip("正在下载导出文件…", true) }
        runCatching {
            var u = URL(url)
            var conn: HttpURLConnection
            var redirects = 0
            while (true) {
                conn = u.openConnection() as HttpURLConnection
                conn.instanceFollowRedirects = false
                CookieManager.getInstance().getCookie(u.toString())?.let { conn.setRequestProperty("Cookie", it) }
                conn.setRequestProperty("User-Agent", ua ?: web.settings.userAgentString)
                conn.setRequestProperty("Referer", START_URL)
                conn.connectTimeout = 20000; conn.readTimeout = 60000
                val code = conn.responseCode
                if (code in 300..399 && redirects < 5) { u = URL(u, conn.getHeaderField("Location")); redirects++; continue }
                if (code !in 200..299) throw RuntimeException("服务器返回 $code")
                break
            }
            val f = File(cacheDir, "web_export_${System.currentTimeMillis()}_$name")
            conn.inputStream.use { inp -> FileOutputStream(f).use { inp.copyTo(it) } }
            runOnUiThread { deliver(f) }
        }.onFailure { runOnUiThread { showTip("下载失败：${it.message}\n可以再点一次导出试试", false) } }
    }

    private fun deliver(f: File) {
        if (done) return
        if (f.length() < 20) { showTip("收到的文件是空的，请再点一次导出", false); return }
        done = true
        Toast.makeText(this, "已收到导出文件，正在导入…", Toast.LENGTH_SHORT).show()
        setResult(RESULT_OK, Intent().putExtra(EXTRA_PATH, f.absolutePath).putExtra(EXTRA_NAME, f.name.substringAfter('_').substringAfter('_')))
        clearLogin()
        finish()
    }

    private fun cancelAndFinish() {
        clearLogin()
        setResult(RESULT_CANCELED)
        finish()
    }

    /** 隐私：离开后清除这个内置浏览器里的登录信息 */
    private fun clearLogin() {
        runCatching {
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            // 只清除 DeepSeek 站点的数据，绝不能动鲸语自己的存储
            listOf("https://chat.deepseek.com", "https://www.deepseek.com", "https://deepseek.com", "https://platform.deepseek.com")
                .forEach { WebStorage.getInstance().deleteOrigin(it) }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else cancelAndFinish()
    }

    override fun onDestroy() {
        runCatching { out?.close() }
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }
}
