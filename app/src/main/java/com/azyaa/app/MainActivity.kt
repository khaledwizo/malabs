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

    // كل خانة إلها كلمات بحث إنكليزية وعربية منفصلة.
    // الكلمة المهمة بين علامات تنصيص "" حتى جوجل يلتزم بنوع اللبس وما تختلط الأقسام.
    private class Cat(val en: List<String>, val ar: List<String>)

    private val styles = linkedMapOf(
        "محتشم" to Cat(
            listOf("\"modest\" outfit", "\"modest\" maxi skirt outfit", "\"modest\" wide leg pants outfit",
                "\"modest\" fashion look", "\"modest\" long cardigan outfit"),
            listOf("ملابس \"محتشمة\"", "اطلالة \"محتشمة\"", "تنورة طويلة \"محتشمة\"",
                "تنسيق ملابس \"محتشمة\"", "لبس \"محتشم\" كاجوال")
        ),
        "محجبات" to Cat(
            listOf("\"hijab\" outfit", "\"hijab\" outfit with jeans", "\"hijab\" blazer outfit",
                "\"hijab\" maxi skirt outfit", "turkish \"hijab\" outfit", "\"hijab\" casual outfit"),
            listOf("اطلالات \"محجبات\"", "ملابس \"محجبات\" كاجوال", "ستايلات \"محجبات\"",
                "تنسيق ملابس \"محجبات\"", "لبس \"محجبات\" تركي", "\"محجبات\" بالجينز")
        ),
        "عباية" to Cat(
            listOf("\"abaya\" outfit", "modern \"abaya\"", "open \"abaya\" outfit",
                "black \"abaya\" elegant", "embroidered \"abaya\""),
            listOf("\"عباية\" مودرن", "\"عبايات\" خليجية", "\"عباية\" مفتوحة",
                "\"عباية\" سوداء راقية", "\"عبايات\" ملونة")
        ),
        "فساتين طويلة محتشمة" to Cat(
            listOf("modest \"maxi dress\"", "long sleeve \"maxi dress\"",
                "floral \"maxi dress\" modest", "satin \"maxi dress\" modest"),
            listOf("\"فستان طويل\" محتشم", "\"فساتين طويلة\" بأكمام",
                "\"فستان طويل\" ورد", "\"فستان طويل\" ستان")
        ),
        "رسمي / عمل" to Cat(
            listOf("\"office outfit\"", "\"business attire\"", "\"pant suit\" outfit",
                "\"blazer\" office outfit", "\"workwear\" outfit"),
            listOf("\"ملابس عمل\" نسائية رسمية", "\"بدلة\" نسائية رسمية",
                "\"ملابس رسمية\" نسائية", "\"بليزر\" نسائي رسمي")
        ),
        "شتوي" to Cat(
            listOf("\"winter outfit\"", "\"wool coat\" outfit", "\"puffer jacket\" outfit",
                "\"knit sweater\" outfit", "\"trench coat\" outfit"),
            listOf("\"ملابس شتوية\" نسائية", "\"معطف\" نسائي شتوي", "\"جاكيت\" شتوي نسائي",
                "\"بلوفر\" نسائي شتوي", "اطلالة \"شتوية\" نسائية")
        ),
        "شورت جينز" to Cat(
            listOf("\"denim shorts\" outfit", "\"jean shorts\" outfit",
                "high waisted \"denim shorts\" outfit", "\"denim shorts\" street style"),
            listOf("\"شورت جينز\" نسائي", "اطلالة \"شورت جينز\"",
                "تنسيق \"شورت جينز\"", "\"شورت جينز\" صيفي")
        ),
        "شورت بوكسر نسائي" to Cat(
            listOf("\"boxer shorts\" outfit", "\"lounge shorts\" set",
                "\"pajama shorts\" set", "\"loungewear\" shorts set"),
            listOf("\"شورت بوكسر\" نسائي", "\"بيجامة شورت\" نسائية",
                "\"ملابس بيت\" شورت نسائي", "\"طقم بيت\" شورت نسائي")
        ),
        "رياضة ويوغا" to Cat(
            listOf("\"yoga\" outfit", "\"yoga\" leggings set", "\"gym\" outfit",
                "\"pilates\" outfit", "\"activewear\" set", "\"running\" outfit"),
            listOf("ملابس \"يوغا\" نسائية", "ملابس \"رياضية\" نسائية", "طقم \"رياضي\" نسائي",
                "ملابس \"جيم\" نسائية", "ليقنز \"رياضي\" نسائي")
        ),
        "بوركيني" to Cat(
            listOf("\"burkini\"", "\"burkini\" swimwear", "\"modest swimsuit\"", "\"burkini\" beach"),
            listOf("\"بوركيني\"", "\"مايوه شرعي\"", "\"بوركيني\" بحر", "\"مايوه محجبات\"")
        ),
        "ملابس سباحة / بيكيني" to Cat(
            listOf("\"bikini\" swimwear fashion", "\"one piece swimsuit\" fashion", "\"swimwear\" collection"),
            listOf("\"ملابس سباحة\" نسائية", "\"مايوه\" نسائي", "\"بكيني\" نسائي")
        )
    )

    private val modes = linkedMapOf(
        "الكل" to Cat(listOf(""), listOf("")),
        "ستوديو" to Cat(listOf("studio photoshoot", "lookbook photoshoot"), listOf("جلسة تصوير ستوديو", "لوك بوك")),
        "شارع" to Cat(listOf("street style", "outdoor photo"), listOf("ستريت ستايل", "تصوير خارجي")),
        "إطلالة كاملة" to Cat(listOf(""), listOf(""))
    )

    // امرأة لابسة الملابس (مو صورة منتج)، بعمر العشرينات
    private val wearerEn = listOf("woman in her 20s wearing", "20s female model wearing", "young adult woman in her twenties wearing")
    private val wearerAr = listOf("موديل شابة عشرينية ترتدي", "امرأة شابة عشرينية لابسة", "عارضة أزياء شابة ترتدي")

    // إطلالة كاملة للمودل (من الراس للقدم)
    private val fullBodyEn = listOf("full body", "full length photo", "head to toe")
    private val fullBodyAr = listOf("اطلالة كاملة", "صورة كاملة", "من الراس للقدم")

    private val colorsEn = listOf("black", "white", "beige", "pink", "blue", "green", "red", "brown", "navy", "olive", "grey", "burgundy")
    private val colorsAr = listOf("أسود", "أبيض", "بيج", "وردي", "أزرق", "أخضر", "أحمر", "بني", "كحلي", "زيتي", "رمادي", "عنابي")

    // فلاتر جوجل العشوائية (صور كبيرة، صور فوتوغرافية، آخر سنة...)
    private val tbsOptions = listOf("", "", "isz:l", "itp:photo", "qdr:y")

    // استبعاد: الأطفال والمراهقات، الرجال، الكبيرات بالعمر، وصور المنتجات بدون لابسة
    private val excludeEn =
        "-kids -kid -child -children -baby -toddler -teen -teens -girl -girls -boy -boys -men -man " +
        "-elderly -senior -grandma -granny -mature -mannequin -flatlay -hanger -product -shampoo"
    private val excludeAr =
        "-أطفال -طفلة -بناتي -ولادي -رجالي -عجوز -مسنة -مانيكان -شامبو"

    // البحث يتناوب: مرة عربي ومرة إنكليزي
    private var searchArabic = Random.nextBoolean()

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

    /** يبني نص بحث للخانة المختارة فقط، بالعربي أو الإنكليزي، وما يعيد آخر 40 نص */
    private fun buildQuery(arabic: Boolean): String {
        val cat = styles[spStyle.selectedItem as String] ?: styles.values.first()
        val mode = modes[spMode.selectedItem as String] ?: modes.values.first()
        val items = if (arabic) cat.ar else cat.en
        val modePool = if (arabic) mode.ar else mode.en
        var q = ""
        for (attempt in 0 until 15) {
            val parts = mutableListOf(
                (if (arabic) wearerAr else wearerEn).random(),
                items.random(),
                (if (arabic) fullBodyAr else fullBodyEn).random()
            )
            val m = modePool.random()
            if (m.isNotEmpty()) parts.add(m)
            if (Random.nextInt(100) < 25) parts.add((if (arabic) colorsAr else colorsEn).random())
            q = parts.joinToString(" ")
            if (q !in recentQueries) break
        }
        recentQueries.addLast(q)
        while (recentQueries.size > 40) recentQueries.removeFirst()
        currentVariation = if (arabic) "بحث عربي" else "English"
        return q
    }

    /** بحث جديد بجوجل (بالنافذة المخفية) — كل دفعة جديدة تبدّل اللغة */
    private fun newSearch() {
        if (retryRounds == 0) searchArabic = !searchArabic
        val arabic = searchArabic
        val q = "${buildQuery(arabic)} ${if (arabic) excludeAr else excludeEn}".trim().replace(Regex("\\s+"), " ")
        // صفحات أولى فقط حتى تبقى النتائج دقيقة ومطابقة للخانة
        val start = if (retryRounds == 0) listOf(0, 0, 20).random() else listOf(20, 40).random()
        val tbs = tbsOptions.random()
        // safe=active: البحث الآمن مقفول دائماً، tbm=isch: صور جوجل
        val url = "https://www.google.com/search?tbm=isch&safe=active&hl=" + (if (arabic) "ar" else "en") +
                "&q=" + URLEncoder.encode(q, "UTF-8") + "&start=$start" +
                (if (tbs.isNotEmpty()) "&tbs=$tbs" else "")
        searchToken++
        images = emptyList()
        index = 0
        progress.visibility = View.VISIBLE
        txtCredit.text = if (arabic) "جاري البحث بالعربي..." else "جاري البحث بالإنكليزي..."
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
  var out=[], tall=[], seen={};
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
    var h=parseInt(m[2]), w=parseInt(m[3]);
    if(h<250||w<200)continue;
    add(u);
    if(h>=w*1.2) tall.push(u);   // صور طولية = إطلالة كاملة غالباً
  }
  var re2=/imgurl=([^&"]+)/g;
  while((m=re2.exec(html))!==null){ try{ add(decodeURIComponent(m[1])); }catch(e){} }
  if(out.length<3){
    var imgs=document.images;
    for(var i=0;i<imgs.length;i++){ if(imgs[i].naturalWidth>=100) add(imgs[i].src); }
  }
  // إذا عدنا صور طولية كافية نعرضها هي، وإلا نقدمها أول القائمة
  var res = tall.length>=10 ? tall : tall.concat(out.filter(function(x){return tall.indexOf(x)<0;}));
  Android.onImages(__T__, JSON.stringify(res.slice(0,100)));
})();
""".replace("__T__", token.toString())

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
