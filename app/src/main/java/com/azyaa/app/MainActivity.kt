package com.azyaa.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import java.net.URLEncoder

/**
 * أزياء البنات: يبحث بصور جوجل (البحث الآمن مقفول دائماً) داخل نافذة مخفية،
 * يستخرج روابط الصور، ويعرض صورة وحدة فقط. كل «تحديث» = الصورة اللي بعدها.
 */
class MainActivity : AppCompatActivity() {

    // الخانات (عربي -> كلمة البحث) — نساء فقط
    private val styles = linkedMapOf(
        "محتشم" to "modest fashion outfit",
        "محجبات" to "hijab fashion outfit",
        "عباية" to "abaya fashion",
        "فساتين طويلة محتشمة" to "modest long dress fashion",
        "رسمي / عمل" to "modest business attire",
        "شتوي محتشم" to "modest winter coat outfit",
        "بوركيني" to "burkini modest swimwear",
        "ملابس سباحة / بيكيني" to "bikini swimwear fashion model"
    )

    private val modes = linkedMapOf(
        "الكل" to "",
        "ستوديو" to "studio photo",
        "شارع" to "street style",
        "إطلالة كاملة" to "full body",
        "تفاصيل" to "details close up"
    )

    private val variations = listOf(
        "", "black", "white", "beige", "pink", "blue", "green", "red", "brown",
        "elegant", "simple", "trendy", "2026", "classy"
    )

    // استبعاد الأطفال والرجال وإعلانات المنتجات
    private val exclude =
        "-kids -kid -child -children -baby -toddler -teen -girl -girls -boy -boys -men -man -shampoo -product"

    private lateinit var spStyle: Spinner
    private lateinit var spMode: Spinner
    private lateinit var web: WebView        // يعرض صورة وحدة
    private lateinit var searchWeb: WebView  // مخفي خلف العرض: يفتح صور جوجل ويستخرج الروابط
    private lateinit var progress: ProgressBar
    private lateinit var txtCredit: TextView
    private lateinit var btnOpen: Button
    private lateinit var ads: Ads

    private val handler = Handler(Looper.getMainLooper())
    private var images: List<String> = emptyList()
    private var index = 0
    private var lastVariation = ""
    private var currentVariation = ""
    private var searchToken = 0
    private var loadedToken = -1
    private var extractTries = 0

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        spStyle = findViewById(R.id.spStyle)
        spMode = findViewById(R.id.spMode)
        web = findViewById(R.id.web)
        searchWeb = findViewById(R.id.searchWeb)
        progress = findViewById(R.id.progress)
        txtCredit = findViewById(R.id.txtCredit)
        btnOpen = findViewById(R.id.btnOpen)

        spStyle.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, styles.keys.toList())
        spMode.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, modes.keys.toList())

        val bridge = Bridge()

        searchWeb.settings.javaScriptEnabled = true
        searchWeb.settings.domStorageEnabled = true
        searchWeb.addJavascriptInterface(bridge, "Android")
        searchWeb.webViewClient = object : WebViewClient() {
            override fun onPageFinished(v: WebView?, url: String?) {
                val token = searchToken
                extractTries = 0
                handler.postDelayed({ extract(token) }, 800)
            }
        }

        web.settings.javaScriptEnabled = true
        web.addJavascriptInterface(bridge, "Android")
        web.webViewClient = WebViewClient()
        web.setBackgroundColor(0xFF111111.toInt())

        ads = Ads(this).also { it.init() }

        findViewById<Button>(R.id.btnSearch).setOnClickListener {
            ads.showRewardedInterstitial { newSearch(randomize = false) }
        }
        findViewById<Button>(R.id.btnRefresh).setOnClickListener {
            if (images.isEmpty()) { newSearch(false); return@setOnClickListener }
            ads.showRewardedVideo(
                onReward = { showNext() },
                onNotWatched = { Toast.makeText(this, "شاهد الإعلان كاملاً حتى تتبدل الصورة", Toast.LENGTH_SHORT).show() }
            )
        }
        btnOpen.setOnClickListener {
            val u = images.getOrNull(index)
            val target = if (u != null && u.startsWith("https://")) u else searchWeb.url
            target?.let { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) }
        }
    }

    /** بحث جديد بجوجل (بالنافذة المخفية) */
    private fun newSearch(randomize: Boolean) {
        val s = styles[spStyle.selectedItem as String] ?: ""
        val m = modes[spMode.selectedItem as String] ?: ""
        var v = ""
        if (randomize) {
            do { v = variations.random() } while (v == lastVariation && variations.size > 1)
            lastVariation = v
        }
        currentVariation = v
        val q = "women $s $m $v $exclude".trim().replace(Regex("\\s+"), " ")
        // safe=active: البحث الآمن مقفول دائماً، tbm=isch: صور جوجل
        val url = "https://www.google.com/search?tbm=isch&safe=active&hl=ar&q=" +
                URLEncoder.encode(q, "UTF-8")
        searchToken++
        images = emptyList()
        index = 0
        progress.visibility = View.VISIBLE
        txtCredit.text = "جاري البحث..."
        searchWeb.loadUrl(url)
    }

    private fun extract(token: Int) {
        if (token != searchToken || loadedToken == token) return
        searchWeb.evaluateJavascript(extractJs(token), null)
    }

    private fun onImagesFound(token: Int, list: List<String>) {
        if (token != searchToken || loadedToken == token) return
        if (list.isEmpty()) {
            if (extractTries < 3) {
                extractTries++
                handler.postDelayed({ extract(token) }, 1200)
            } else {
                progress.visibility = View.GONE
                txtCredit.text = "ما لگيت صور، اضغط تحديث أو افتح بالمتصفح"
            }
            return
        }
        loadedToken = token
        images = list.shuffled()
        index = 0
        progress.visibility = View.GONE
        showCurrent()
    }

    /** يعرض صورة وحدة فقط */
    private fun showCurrent() {
        val u = images.getOrNull(index) ?: return
        val src = u.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")
        val html = "<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
                "<style>html,body{margin:0;height:100%;background:#111;display:flex;" +
                "align-items:center;justify-content:center}" +
                "img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>" +
                "<img referrerpolicy=\"no-referrer\" src=\"$src\" onerror=\"Android.broken($index)\">" +
                "</body></html>"
        web.loadDataWithBaseURL("https://www.google.com/", html, "text/html", "UTF-8", null)
        txtCredit.text = "${spStyle.selectedItem} • ${spMode.selectedItem}" +
                (if (currentVariation.isNotEmpty()) " • $currentVariation" else "") +
                " • ${index + 1}/${images.size}"
        btnOpen.isEnabled = true
    }

    /** الصورة اللي بعدها، وإذا خلصت القائمة يسوي بحث جديد بكلمة عشوائية */
    private fun showNext() {
        index++
        if (index >= images.size) newSearch(randomize = true) else showCurrent()
    }

    inner class Bridge {
        @JavascriptInterface
        fun onImages(token: Int, json: String) {
            val list = try {
                val arr = JSONArray(json)
                (0 until arr.length()).map { arr.getString(it) }
            } catch (e: Exception) { emptyList() }
            runOnUiThread { onImagesFound(token, list) }
        }

        @JavascriptInterface
        fun broken(i: Int) {
            // الصورة ما انفتحت (محمية أو محذوفة): نعبر للي بعدها بدون إعلان
            runOnUiThread { if (i == index && images.isNotEmpty()) showNext() }
        }
    }

    /** سكربت يستخرج روابط الصور الأصلية من صفحة صور جوجل */
    private fun extractJs(token: Int) = """
(function(){
  var out=[], seen={};
  function add(u){
    if(!u||seen[u])return;
    if(u.indexOf('https://')!==0 && u.indexOf('data:image')!==0)return;
    seen[u]=1; out.push(u);
  }
  var html=document.documentElement.innerHTML, m;
  var re=/\["(https:\/\/[^"]+?)",(\d+),(\d+)\]/g;
  while((m=re.exec(html))!==null){
    var u=m[1];
    try{ u=JSON.parse('"'+u+'"'); }catch(e){}
    if(/gstatic\.com|google\.|googleusercontent/.test(u))continue;
    if(parseInt(m[2])<250||parseInt(m[3])<200)continue;
    add(u);
  }
  var re2=/imgurl=([^&"]+)/g;
  while((m=re2.exec(html))!==null){ try{ add(decodeURIComponent(m[1])); }catch(e){} }
  if(out.length<3){
    var imgs=document.images;
    for(var i=0;i<imgs.length;i++){ if(imgs[i].naturalWidth>=100) add(imgs[i].src); }
  }
  Android.onImages(__T__, JSON.stringify(out.slice(0,80)));
})();
""".replace("__T__", token.toString())

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
