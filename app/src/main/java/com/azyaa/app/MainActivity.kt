package com.azyaa.app

import android.annotation.SuppressLint
import android.content.Context
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
import kotlin.random.Random

/**
 * أزياء البنات: يبحث بصور جوجل (البحث الآمن مقفول دائماً) داخل نافذة مخفية،
 * يستخرج روابط الصور، ويعرض صورة وحدة فقط. كل «تحديث» = الصورة اللي بعدها.
 */
class MainActivity : AppCompatActivity() {

    // الخانات (عربي -> عدة كلمات بحث) — نساء فقط
    // كل خانة إلها أكثر من نص بحث حتى تطلع نتائج مختلفة بكل مرة
    private val styles = linkedMapOf(
        "محتشم" to listOf(
            "modest fashion outfit", "modest maxi skirt outfit", "modest wide leg pants outfit",
            "modest oversized shirt outfit", "modest kimono outfit", "modest layered outfit",
            "modest fashion lookbook", "modest chic outfit"
        ),
        "محجبات" to listOf(
            "hijab fashion outfit", "hijab street style outfit", "hijab casual outfit ideas",
            "turkish hijab fashion", "hijab outfit with jeans", "hijab blazer outfit",
            "hijab maxi skirt outfit", "hijab fashion week look", "hijab summer outfit",
            "hijab chic outfit"
        ),
        "عباية" to listOf(
            "abaya fashion", "modern abaya design", "open abaya outfit", "black abaya elegant",
            "colored abaya fashion", "abaya kimono style", "embroidered abaya"
        ),
        "فساتين طويلة محتشمة" to listOf(
            "modest long dress fashion", "maxi dress modest", "long sleeve maxi dress",
            "floral maxi dress modest", "satin maxi dress modest", "evening long dress modest"
        ),
        "رسمي / عمل" to listOf(
            "modest business attire", "women office outfit blazer", "women pant suit outfit",
            "women workwear chic", "women office look trousers", "women formal suit fashion",
            "women blazer dress office"
        ),
        "شتوي" to listOf(
            "modest winter coat outfit", "women wool coat outfit", "women puffer jacket outfit",
            "women knit sweater outfit", "women winter boots outfit", "women trench coat outfit",
            "women cardigan winter outfit", "women turtleneck outfit"
        ),
        "شورت جينز" to listOf(
            "denim shorts outfit women", "jean shorts summer outfit", "high waisted denim shorts outfit",
            "denim shorts street style women", "denim shorts with shirt outfit"
        ),
        "شورت بوكسر نسائي" to listOf(
            "women boxer shorts outfit", "women lounge shorts set", "women pajama shorts set",
            "women cotton boxer shorts", "women loungewear set"
        ),
        "رياضة ويوغا" to listOf(
            "yoga outfit women", "yoga set leggings top", "women activewear set",
            "women gym outfit", "pilates outfit women", "women running outfit",
            "women tennis outfit", "modest activewear women"
        ),
        "بوركيني" to listOf(
            "burkini modest swimwear", "burkini fashion", "modest swimsuit women",
            "burkini two piece", "modest swimwear beach outfit"
        ),
        "ملابس سباحة / بيكيني" to listOf(
            "bikini swimwear fashion model", "swimwear fashion collection", "one piece swimsuit fashion"
        )
    )

    private val modes = linkedMapOf(
        "الكل" to listOf(""),
        "ستوديو" to listOf("studio photo", "lookbook photoshoot", "editorial photoshoot"),
        "شارع" to listOf("street style", "city street outfit", "outdoor photo"),
        "إطلالة كاملة" to listOf("full body", "head to toe look", "full length outfit"),
        "تفاصيل" to listOf("details close up", "fabric detail", "outfit accessories")
    )

    private val colors = listOf(
        "black", "white", "beige", "pink", "blue", "green", "red", "brown",
        "navy", "olive", "grey", "burgundy", "cream", "pastel"
    )
    private val variations = listOf(
        "elegant", "simple", "trendy", "2026", "classy", "chic", "minimal",
        "luxury", "casual", "new collection", "aesthetic", "inspiration"
    )
    // فلاتر جوجل العشوائية (حجم كبير، صور فوتوغرافية، آخر سنة...)
    private val tbsOptions = listOf("", "", "isz:l", "itp:photo", "qdr:y", "isz:m")

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
    private var retryRounds = 0
    private val recentQueries = ArrayDeque<String>()

    // الصور اللي ظهرت سابقاً (تنحفظ حتى بعد سد التطبيق) حتى ما تتكرر
    private val seen = LinkedHashSet<String>()
    private val maxSeen = 5000

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

        loadSeen()

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
            ads.showRewardedInterstitial { retryRounds = 0; newSearch() }
        }
        findViewById<Button>(R.id.btnRefresh).setOnClickListener {
            if (images.isEmpty()) { retryRounds = 0; newSearch(); return@setOnClickListener }
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

    /** يبني نص بحث جديد بكل مرة (كلمة + ستايل + لون/وصف عشوائي) وما يعيد آخر 40 نص */
    private fun buildQuery(): String {
        val pool = styles[spStyle.selectedItem as String] ?: styles.values.flatten()
        val modePool = modes[spMode.selectedItem as String] ?: listOf("")
        var q = ""
        var v = ""
        for (attempt in 0 until 15) {
            val base = pool.random()
            val parts = mutableListOf<String>()
            if (!base.contains("women")) parts.add("women")
            parts.add(base)
            val m = modePool.random()
            if (m.isNotEmpty()) parts.add(m)
            val extra = mutableListOf<String>()
            if (Random.nextInt(100) < 55) extra.add(colors.random())
            if (Random.nextInt(100) < 45) extra.add(variations.random())
            parts.addAll(extra)
            q = parts.joinToString(" ")
            v = extra.joinToString(" ")
            if (q !in recentQueries) break
        }
        recentQueries.addLast(q)
        while (recentQueries.size > 40) recentQueries.removeFirst()
        currentVariation = v
        return q
    }

    /** بحث جديد بجوجل (بالنافذة المخفية) — صفحة وفلتر عشوائي حتى تتجدد النتائج */
    private fun newSearch() {
        val q = "${buildQuery()} $exclude".trim().replace(Regex("\\s+"), " ")
        val start = if (retryRounds == 0) listOf(0, 0, 20, 40, 60).random()
                    else listOf(40, 60, 80, 100, 120).random()
        val tbs = tbsOptions.random()
        // safe=active: البحث الآمن مقفول دائماً، tbm=isch: صور جوجل
        val url = "https://www.google.com/search?tbm=isch&safe=active&hl=ar&q=" +
                URLEncoder.encode(q, "UTF-8") + "&start=$start" +
                (if (tbs.isNotEmpty()) "&tbs=$tbs" else "")
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
        // نشيل الصور اللي ظهرت قبل؛ إذا أغلبها مكررة نبحث بنص وصفحة ثانية تلقائياً
        val fresh = list.filter { it !in seen }
        if (fresh.size < 12 && retryRounds < 3) {
            retryRounds++
            newSearch()
            return
        }
        retryRounds = 0
        loadedToken = token
        images = (if (fresh.isNotEmpty()) fresh else list).shuffled()
        index = 0
        progress.visibility = View.GONE
        showCurrent()
    }

    /** يعرض صورة وحدة فقط */
    private fun showCurrent() {
        val u = images.getOrNull(index) ?: return
        markSeen(u)
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
        if (index >= images.size) { saveSeen(); retryRounds = 0; newSearch() } else showCurrent()
    }

    private fun markSeen(url: String) {
        seen.remove(url)
        seen.add(url)
        while (seen.size > maxSeen) seen.remove(seen.first())
    }

    private fun loadSeen() {
        val s = getSharedPreferences("azyaa", Context.MODE_PRIVATE).getString("seen", "") ?: ""
        if (s.isNotEmpty()) seen.addAll(s.split("\n"))
    }

    private fun saveSeen() {
        getSharedPreferences("azyaa", Context.MODE_PRIVATE).edit()
            .putString("seen", seen.joinToString("\n")).apply()
    }

    override fun onPause() {
        super.onPause()
        saveSeen()
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
  Android.onImages(__T__, JSON.stringify(out.slice(0,100)));
})();
""".replace("__T__", token.toString())

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
