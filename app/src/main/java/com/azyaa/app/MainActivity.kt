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
 *
 * محرك البحث الذكي:
 *  - يركّب نص البحث من قطع (لابسة + نوع اللبس + وضعية + نمط + لون...) بشكل عشوائي.
 *  - يتعلم: الكلمات اللي تجيب نتائج جديدة يزيد احتمالها، واللي ما تجيب شي يقل.
 *  - إذا ما طلعت نتائج يبسّط النص خطوة خطوة، وبالوضع التلقائي يبدّل اللغة.
 */
class MainActivity : AppCompatActivity() {

    /** كلمات بحث إنكليزية وعربية لكل خيار. key = كلمة عامة للبحث الاحتياطي */
    private class Opt(val en: List<String>, val ar: List<String>, val keyEn: String = "", val keyAr: String = "")

    // ===== الستايل: نوع الملابس =====
    // الإنكليزي: الكلمة المهمة بين "" حتى ما تختلط الأقسام
    // العربي: نص مختصر وشامل لأن نتائج العربي أقل
    private val styles = linkedMapOf(
        "محتشم" to Opt(
            listOf("\"modest\" outfit", "\"modest\" maxi skirt outfit", "\"modest\" wide leg pants outfit",
                "\"modest\" fashion look", "\"modest\" long cardigan outfit"),
            listOf("ملابس محتشمة", "لبس محتشم", "اطلالات محتشمة", "تنسيقات محتشمة"),
            "modest outfit", "ملابس محتشمة"
        ),
        "محجبات" to Opt(
            listOf("\"hijab\" outfit", "\"hijab\" outfit with jeans", "\"hijab\" blazer outfit",
                "\"hijab\" maxi skirt outfit", "turkish \"hijab\" outfit", "\"hijab\" casual outfit"),
            listOf("لبس محجبات", "اطلالات محجبات", "ستايل محجبات", "محجبات كاجوال"),
            "hijab outfit", "محجبات"
        ),
        "عباية" to Opt(
            listOf("\"abaya\" outfit", "modern \"abaya\"", "open \"abaya\" outfit",
                "black \"abaya\" elegant", "embroidered \"abaya\""),
            listOf("عبايات", "عباية مودرن", "عبايات خليجية", "عباية سوداء"),
            "abaya", "عبايات"
        ),
        "فساتين طويلة محتشمة" to Opt(
            listOf("modest \"maxi dress\"", "long sleeve \"maxi dress\"",
                "floral \"maxi dress\" modest", "satin \"maxi dress\" modest"),
            listOf("فساتين طويلة", "فستان طويل محتشم", "فساتين سهرة طويلة"),
            "maxi dress", "فساتين طويلة"
        ),
        "رسمي / عمل" to Opt(
            listOf("\"office outfit\"", "\"business attire\"", "\"pant suit\" outfit",
                "\"blazer\" office outfit", "\"workwear\" outfit"),
            listOf("ملابس رسمية نسائية", "لبس دوام نسائي", "بدلة نسائية", "بليزر نسائي"),
            "women office outfit", "ملابس رسمية نسائية"
        ),
        "شتوي" to Opt(
            listOf("\"winter outfit\"", "\"wool coat\" outfit", "\"puffer jacket\" outfit",
                "\"knit sweater\" outfit", "\"trench coat\" outfit"),
            listOf("ملابس شتوية نسائية", "معطف نسائي", "جاكيت شتوي نسائي", "اطلالات شتوية"),
            "women winter outfit", "ملابس شتوية نسائية"
        ),
        "شورت جينز" to Opt(
            listOf("\"denim shorts\" outfit", "\"jean shorts\" outfit",
                "high waisted \"denim shorts\" outfit", "\"denim shorts\" street style"),
            listOf("شورت جينز نسائي", "شورت جينز", "تنسيق شورت جينز"),
            "denim shorts outfit", "شورت جينز نسائي"
        ),
        "شورت بوكسر نسائي" to Opt(
            listOf("\"boxer shorts\" outfit", "\"lounge shorts\" set",
                "\"pajama shorts\" set", "\"loungewear\" shorts set"),
            listOf("شورت بوكسر نسائي", "بيجامة شورت نسائية", "ملابس بيت نسائية"),
            "women lounge shorts", "بيجامة شورت نسائية"
        ),
        "رياضة ويوغا" to Opt(
            listOf("\"yoga\" outfit", "\"yoga\" leggings set", "\"gym\" outfit",
                "\"pilates\" outfit", "\"activewear\" set", "\"running\" outfit"),
            listOf("ملابس رياضية نسائية", "ملابس يوغا", "لبس جيم نسائي", "طقم رياضي نسائي"),
            "women activewear", "ملابس رياضية نسائية"
        ),
        "بوركيني" to Opt(
            listOf("\"burkini\"", "\"burkini\" swimwear", "\"modest swimsuit\"", "\"burkini\" beach"),
            listOf("بوركيني", "مايوه شرعي", "مايوه محجبات"),
            "burkini", "بوركيني"
        ),
        "ملابس سباحة / بيكيني" to Opt(
            listOf("\"bikini\" swimwear fashion", "\"one piece swimsuit\" fashion", "\"swimwear\" collection"),
            listOf("ملابس سباحة نسائية", "مايوه نسائي"),
            "swimwear fashion", "ملابس سباحة نسائية"
        )
    )

    // ===== النمط: طريقة التصوير =====
    private val modes = linkedMapOf(
        "الكل" to Opt(listOf(""), listOf("")),
        "ستوديو" to Opt(listOf("studio photoshoot", "lookbook photoshoot"), listOf("ستوديو", "لوك بوك")),
        "شارع" to Opt(listOf("street style", "outdoor photo"), listOf("ستريت ستايل", "تصوير خارجي")),
        "إطلالة كاملة" to Opt(listOf("full body"), listOf("اطلالة كاملة"))
    )

    // ===== الوضعية / المكان =====
    private val poses = linkedMapOf(
        "الكل" to Opt(listOf(""), listOf("")),
        "واقفة" to Opt(listOf("standing pose", "standing"), listOf("واقفة", "وقفة")),
        "تمشي" to Opt(listOf("walking pose", "walking in street"), listOf("تمشي", "مشية")),
        "جالسة (كنبة / كرسي)" to Opt(listOf("sitting on sofa", "sitting on chair", "sitting pose"),
            listOf("جالسة على كنبة", "جالسة على كرسي", "جلسة")),
        "جانبية" to Opt(listOf("side profile pose", "side view outfit"), listOf("وقفة جانبية", "صورة جانبية")),
        "سيلفي مراية" to Opt(listOf("mirror selfie outfit", "mirror selfie"), listOf("سيلفي مراية", "سيلفي بالمراية")),
        "كافيه" to Opt(listOf("cafe photoshoot", "coffee shop outfit"), listOf("كافيه", "بالكافيه")),
        "بالطبيعة" to Opt(listOf("garden photoshoot", "nature photoshoot"), listOf("بالطبيعة", "حديقة")),
        "بالمدينة ليلاً" to Opt(listOf("city night photoshoot", "night street style"), listOf("تصوير ليلي", "بالليل"))
    )

    // ===== لغة البحث =====
    private val LANG_AUTO = "تلقائي (عربي + English)"
    private val LANG_AR = "عربي"
    private val LANG_EN = "English"
    private val langs = listOf(LANG_AUTO, LANG_AR, LANG_EN)

    // ===== العمر (بالغات فقط) =====
    private val ages = linkedMapOf(
        "عشرينات (18-29)" to Opt(
            listOf("woman in her 20s wearing", "20s female model wearing", "young adult woman wearing"),
            listOf("موديل", "شابة", "")),
        "ثلاثينات" to Opt(
            listOf("woman in her 30s wearing", "30s female model wearing", "stylish woman in her thirties wearing"),
            listOf("ثلاثينية", "موديل", "")),
        "أربعينات" to Opt(
            listOf("woman in her 40s wearing", "stylish 40s woman wearing"),
            listOf("أربعينية", "سيدة أنيقة", ""))
    )
    private fun ageExclude(age: String) = when {
        age.startsWith("عشرينات") -> " -elderly -senior -grandma -granny -mature -over 40"
        age.startsWith("ثلاثينات") -> " -elderly -senior -grandma -granny"
        else -> " -elderly -grandma -granny"
    }

    // ===== ترتيب الصور =====
    private val SORT_BEST = "✨ الأجمل أولاً"
    private val SORT_RANDOM = "🎲 عشوائي"
    private val sorts = listOf(SORT_BEST, SORT_RANDOM)

    // قطع إضافية للتنويع
    private val fullBodyEn = listOf("full body", "full length photo", "head to toe")
    private val fullBodyAr = listOf("اطلالة كاملة", "")
    private val adjEn = listOf("elegant", "casual", "chic", "trendy", "classy", "minimal", "2026")
    private val adjAr = listOf("كاجوال", "راقي", "ترند", "ناعم")
    private val colorsEn = listOf("black", "white", "beige", "pink", "blue", "green", "red", "brown", "navy", "olive", "grey", "burgundy")
    private val colorsAr = listOf("أسود", "أبيض", "بيج", "وردي", "أزرق", "أخضر", "أحمر", "بني", "كحلي")

    // فلاتر جوجل العشوائية (صور كبيرة، صور فوتوغرافية، آخر سنة...)
    private val tbsOptions = listOf("", "", "isz:l", "itp:photo", "qdr:y")

    // استبعاد: الأطفال والمراهقات، الرجال، الكبيرات بالعمر، وصور المنتجات بدون لابسة
    private val excludeEn =
        "-kids -kid -child -children -baby -toddler -teen -teens -girl -girls -boy -boys -men -man " +
        "-mannequin -flatlay -hanger -product -shampoo"
    private val excludeAr = "-أطفال -طفلة -بناتي -ولادي -رجالي -عجوز"

    private lateinit var spStyle: Spinner
    private lateinit var spMode: Spinner
    private lateinit var spPose: Spinner
    private lateinit var spLang: Spinner
    private lateinit var spAge: Spinner
    private lateinit var spSort: Spinner
    private lateinit var web: WebView        // يعرض صورة وحدة
    private lateinit var searchWeb: WebView  // مخفي خلف العرض: يفتح صور جوجل ويستخرج الروابط
    private lateinit var progress: ProgressBar
    private lateinit var txtCredit: TextView
    private lateinit var btnOpen: Button
    private lateinit var btnFav: Button
    private lateinit var btnFavs: Button
    private lateinit var btnShare: Button
    private lateinit var ads: Ads

    private val handler = Handler(Looper.getMainLooper())
    private var images: List<String> = emptyList()
    private var index = 0
    private var searchToken = 0
    private var loadedToken = -1
    private var extractTries = 0

    // حالة البحث الحالي
    private var searchArabic = Random.nextBoolean()
    private var level = 0          // 0 = نص كامل، 1 = أبسط، 2 = أبسط، 3 = كلمة عامة
    private var retryRounds = 0    // كم مرة أعاد البحث بهاي الدفعة
    private var langSwitched = false
    private var currentItem = ""   // الكلمة الأساسية المستخدمة (للتعلم)
    private var currentLabel = ""
    private val recentQueries = ArrayDeque<String>()

    // الصور اللي ظهرت سابقاً (تنحفظ حتى بعد سد التطبيق) حتى ما تتكرر
    private val seen = LinkedHashSet<String>()
    private val maxSeen = 5000

    // المفضلة
    private val favs = mutableListOf<String>()
    private var viewingFavs = false

    // «الذكاء البسيط»: نقاط لكل كلمة بحث حسب النتائج
    private val scores = HashMap<String, Int>()
    // نقاط المواقع: المواقع اللي تحفظ منها صور تطلع صورها أول، واللي صورها خربانة تنزل
    private val hostScores = HashMap<String, Int>()
    // أبعاد صور الدفعة الحالية (طول، عرض) لترتيب الأجمل
    private val dims = HashMap<String, Pair<Int, Int>>()
    // الكلمات اللي انبنى عليها البحث الحالي (حتى نكافئها إذا حفظت صورة)
    private var currentParts: List<String> = emptyList()

    private val prefs by lazy { getSharedPreferences("azyaa", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        spStyle = findViewById(R.id.spStyle)
        spMode = findViewById(R.id.spMode)
        spPose = findViewById(R.id.spPose)
        spLang = findViewById(R.id.spLang)
        spAge = findViewById(R.id.spAge)
        spSort = findViewById(R.id.spSort)
        web = findViewById(R.id.web)
        searchWeb = findViewById(R.id.searchWeb)
        progress = findViewById(R.id.progress)
        txtCredit = findViewById(R.id.txtCredit)
        btnOpen = findViewById(R.id.btnOpen)
        btnFav = findViewById(R.id.btnFav)
        btnFavs = findViewById(R.id.btnFavs)
        btnShare = findViewById(R.id.btnShare)

        loadState()

        spStyle.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, styles.keys.toList())
        spMode.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, modes.keys.toList())
        spPose.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, poses.keys.toList())
        spLang.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, langs)
        spAge.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, ages.keys.toList())
        spSort.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, sorts)
        // يحفظ اختيارات اللغة والعمر والترتيب
        remember(spLang, "lang", langs.size)
        remember(spAge, "age", ages.size)
        remember(spSort, "sort", sorts.size)
        updateFavsButton()

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
            ads.showRewardedInterstitial { startNewBatch() }
        }
        findViewById<Button>(R.id.btnSurprise).setOnClickListener {
            // اختيار عشوائي للستايل والوضعية والنمط
            spStyle.setSelection(Random.nextInt(styles.size))
            spPose.setSelection(Random.nextInt(poses.size))
            spMode.setSelection(Random.nextInt(modes.size))
            ads.showRewardedInterstitial { startNewBatch() }
        }
        findViewById<Button>(R.id.btnRefresh).setOnClickListener {
            if (images.isEmpty()) { startNewBatch(); return@setOnClickListener }
            ads.showRewardedVideo(
                onReward = { showNext() },
                onNotWatched = { Toast.makeText(this, "شاهد الإعلان كاملاً حتى تتبدل الصورة", Toast.LENGTH_SHORT).show() }
            )
        }
        btnOpen.setOnClickListener {
            val u = images.getOrNull(index)
            val target = if (u != null && u.startsWith("https://")) u else searchWeb.url
            target?.let { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } catch (_: Exception) {} }
        }
        btnShare.setOnClickListener {
            val u = images.getOrNull(index) ?: return@setOnClickListener
            if (!u.startsWith("https://")) return@setOnClickListener
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, u)
            }
            startActivity(Intent.createChooser(send, "مشاركة الصورة"))
        }
        btnFav.setOnClickListener { toggleFav() }
        btnFavs.setOnClickListener { openFavs() }
    }

    private fun remember(sp: Spinner, key: String, size: Int) {
        sp.setSelection(prefs.getInt(key, 0).coerceIn(0, size - 1))
        sp.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                prefs.edit().putInt(key, pos).apply()
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    // ================= محرك البحث الذكي =================

    private fun langMode(): String = spLang.selectedItem as String

    /** يختار كلمة من القائمة؛ الكلمات اللي جابت نتائج جيدة إلها فرصة أكبر */
    private fun pickWeighted(items: List<String>): String {
        if (items.size <= 1) return items.firstOrNull() ?: ""
        val w = items.map { (1.0 + (scores[it] ?: 0) * 0.35).coerceIn(0.15, 4.0) }
        var r = Random.nextDouble() * w.sum()
        for (i in items.indices) { r -= w[i]; if (r <= 0) return items[i] }
        return items.last()
    }

    private fun learn(item: String, delta: Int) {
        if (item.isEmpty()) return
        scores[item] = ((scores[item] ?: 0) + delta).coerceIn(-5, 8)
    }

    /** يبني نص البحث حسب اللغة ومستوى التبسيط */
    private fun buildQuery(arabic: Boolean, lvl: Int): String {
        val st = styles[spStyle.selectedItem as String] ?: styles.values.first()
        val md = modes[spMode.selectedItem as String] ?: modes.values.first()
        val ps = poses[spPose.selectedItem as String] ?: poses.values.first()
        val ag = ages[spAge.selectedItem as String] ?: ages.values.first()
        var q = ""
        for (attempt in 0 until 15) {
            val parts = mutableListOf<String>()
            if (arabic) {
                // العربي: مختصر وشامل
                currentItem = if (lvl >= 3) st.keyAr else pickWeighted(st.ar)
                parts.add(currentItem)
                if (lvl <= 1) parts.add(pickWeighted(ps.ar))
                if (lvl == 0) {
                    if (Random.nextInt(100) < 60) parts.add(pickWeighted(ag.ar))
                    if (Random.nextInt(100) < 35) parts.add(fullBodyAr.random())
                    if (Random.nextInt(100) < 25) parts.add(pickWeighted(md.ar))
                    if (Random.nextInt(100) < 20) parts.add((if (Random.nextBoolean()) colorsAr else adjAr).random())
                }
            } else {
                currentItem = if (lvl >= 3) st.keyEn else pickWeighted(st.en)
                when (lvl) {
                    0 -> {
                        parts.add(pickWeighted(ag.en)); parts.add(currentItem)
                        parts.add(fullBodyEn.random()); parts.add(pickWeighted(ps.en)); parts.add(pickWeighted(md.en))
                        if (Random.nextInt(100) < 25) parts.add(colorsEn.random())
                        if (Random.nextInt(100) < 20) parts.add(adjEn.random())
                    }
                    1 -> { parts.add("woman wearing"); parts.add(currentItem); parts.add(pickWeighted(ps.en)) }
                    2 -> { parts.add(currentItem.replace("\"", "")); parts.add("model") }
                    else -> parts.add(currentItem)
                }
            }
            currentParts = parts.filter { it.isNotBlank() }
            q = currentParts.joinToString(" ")
            if (q !in recentQueries) break
        }
        recentQueries.addLast(q)
        while (recentQueries.size > 60) recentQueries.removeFirst()
        return q
    }

    /** دفعة جديدة (من زر بحث أو لما تخلص الصور) */
    private fun startNewBatch() {
        level = 0
        retryRounds = 0
        langSwitched = false
        searchArabic = when (langMode()) {
            LANG_AR -> true
            LANG_EN -> false
            else -> !searchArabic   // تلقائي: مرة عربي ومرة إنكليزي
        }
        newSearch()
    }

    /** يبحث بجوجل بالنافذة المخفية حسب الحالة الحالية */
    private fun newSearch() {
        viewingFavs = false
        val arabic = searchArabic
        val q = ("${buildQuery(arabic, level)} " +
                (if (arabic) excludeAr else excludeEn + ageExclude(spAge.selectedItem as String))).trim()
            .replace(Regex("\\s+"), " ")
        // صفحات أولى فقط حتى تبقى النتائج دقيقة
        val start = if (retryRounds == 0 || level > 0) 0 else listOf(0, 20, 40).random()
        val tbs = if (level == 0) tbsOptions.random() else ""
        // safe=active: البحث الآمن مقفول دائماً، tbm=isch: صور جوجل
        val url = "https://www.google.com/search?tbm=isch&safe=active&hl=" + (if (arabic) "ar" else "en") +
                "&q=" + URLEncoder.encode(q, "UTF-8") + "&start=$start" +
                (if (tbs.isNotEmpty()) "&tbs=$tbs" else "")
        searchToken++
        images = emptyList()
        index = 0
        progress.visibility = View.VISIBLE
        btnFav.isEnabled = false; btnShare.isEnabled = false
        currentLabel = if (arabic) "بحث عربي" else "English"
        txtCredit.text = when {
            retryRounds == 0 -> if (arabic) "جاري البحث بالعربي..." else "Searching in English..."
            else -> "أجرب نص بحث ثاني... ($retryRounds)"
        }
        searchWeb.loadUrl(url)
    }

    /** ما طلعت نتائج كافية: نغيّر النص بذكاء ونعيد */
    private fun retry(emptyResult: Boolean): Boolean {
        if (retryRounds >= 6) return false
        retryRounds++
        if (emptyResult) {
            learn(currentItem, -2)
            if (level < 3) level++
            else if (langMode() == LANG_AUTO && !langSwitched) {
                // جربنا كل المستويات: نبدل اللغة ونرجع للنص الكامل
                langSwitched = true; searchArabic = !searchArabic; level = 0
            } else return false
        } else {
            // النتائج موجودة بس أغلبها شفناها: نفس المستوى بنص وصفحة مختلفة
            learn(currentItem, -1)
        }
        newSearch()
        return true
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
                return
            }
            if (!retry(emptyResult = true)) {
                progress.visibility = View.GONE
                txtCredit.text = "ما لگيت صور، غيّر الاختيارات أو اضغط بحث مرة ثانية"
            }
            return
        }
        // نشيل الصور اللي ظهرت قبل؛ إذا أغلبها مكررة نعيد البحث بنص مغاير
        val fresh = list.filter { it !in seen }
        if (fresh.size < 12 && retry(emptyResult = fresh.isEmpty() && list.size < 5)) return

        learn(currentItem, if (fresh.size >= 20) 2 else 1)
        loadedToken = token
        images = rank(if (fresh.isNotEmpty()) fresh else list)
        index = 0
        progress.visibility = View.GONE
        saveState()
        showCurrent()
    }

    private fun hostOf(u: String): String = try { Uri.parse(u).host?.removePrefix("www.") ?: "" } catch (_: Exception) { "" }

    /**
     * «الأجمل أولاً»: نقاط لكل صورة حسب الدقة (كبر الصورة)، الصورة الطولية (إطلالة كاملة)،
     * والمواقع اللي حفظت منها صور قبل. وشوية عشوائية حتى ما تصير مملة.
     */
    private fun rank(list: List<String>): List<String> {
        if (spSort.selectedItem as String == SORT_RANDOM) return list.shuffled()
        return list.map { u ->
            val (h, w) = dims[u] ?: (0 to 0)
            var score = Random.nextDouble() * 1.5
            if (h > 0 && w > 0) {
                score += Math.log10((h.toDouble() * w).coerceAtLeast(1.0)) - 5.0   // 1MP ≈ +1
                if (h >= w * 1.2) score += 1.2                                      // طولية
                if (h < 500) score -= 1.0                                           // صغيرة
            }
            score += (hostScores[hostOf(u)] ?: 0) * 0.4
            u to score
        }.sortedByDescending { it.second }.map { it.first }
    }

    // ================= العرض =================

    /** يعرض صورة وحدة فقط */
    private fun showCurrent() {
        val u = images.getOrNull(index) ?: return
        if (!viewingFavs) markSeen(u)
        val src = u.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")
        val html = "<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
                "<style>html,body{margin:0;height:100%;background:#111;display:flex;" +
                "align-items:center;justify-content:center}" +
                "img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>" +
                "<img referrerpolicy=\"no-referrer\" src=\"$src\" onerror=\"Android.broken($index)\">" +
                "</body></html>"
        web.loadDataWithBaseURL("https://www.google.com/", html, "text/html", "UTF-8", null)
        txtCredit.text = if (viewingFavs) "⭐ المفضلة • ${index + 1}/${images.size}"
        else "${spStyle.selectedItem} • ${spPose.selectedItem} • $currentLabel • ${index + 1}/${images.size}"
        val https = u.startsWith("https://")
        btnOpen.isEnabled = true
        btnShare.isEnabled = https
        btnFav.isEnabled = https
        btnFav.text = if (u in favs) "❤️ محفوظة" else "🤍 حفظ"
    }

    /** الصورة اللي بعدها، وإذا خلصت القائمة يسوي دفعة جديدة بنص جديد */
    private fun showNext() {
        index++
        if (index >= images.size) {
            if (viewingFavs) {
                index = 0
                Toast.makeText(this, "رجعنا لأول صورة بالمفضلة", Toast.LENGTH_SHORT).show()
                showCurrent()
            } else {
                saveState()
                startNewBatch()
            }
        } else showCurrent()
    }

    // ================= المفضلة =================

    private fun toggleFav() {
        val u = images.getOrNull(index) ?: return
        if (u in favs) {
            favs.remove(u)
            saveState()
            Toast.makeText(this, "انشالت من المفضلة", Toast.LENGTH_SHORT).show()
        } else {
            favs.add(u)
            // نتعلم من ذوقك: الكلمات والموقع اللي جابوا هاي الصورة ياخذون أولوية
            if (!viewingFavs) {
                learn(currentItem, 3)
                currentParts.forEach { learn(it, 1) }
            }
            val h = hostOf(u)
            if (h.isNotEmpty()) hostScores[h] = ((hostScores[h] ?: 0) + 2).coerceIn(-5, 10)
            Toast.makeText(this, "انحفظت بالمفضلة ⭐ (راح أجيبلك صور تشبهها أكثر)", Toast.LENGTH_SHORT).show()
        }
        saveFavs()
        updateFavsButton()
        btnFav.text = if (u in favs) "❤️ محفوظة" else "🤍 حفظ"
    }

    private fun openFavs() {
        if (favs.isEmpty()) {
            Toast.makeText(this, "ما عندك صور محفوظة بعد. اضغط 🤍 حفظ على أي صورة تعجبك", Toast.LENGTH_LONG).show()
            return
        }
        searchToken++            // نلغي أي بحث شغال
        progress.visibility = View.GONE
        viewingFavs = true
        images = favs.reversed() // الأحدث أول
        index = 0
        showCurrent()
    }

    private fun updateFavsButton() {
        btnFavs.text = if (favs.isEmpty()) "⭐ المفضلة" else "⭐ المفضلة (${favs.size})"
    }

    // ================= الحفظ =================

    private fun markSeen(url: String) {
        seen.remove(url)
        seen.add(url)
        while (seen.size > maxSeen) seen.remove(seen.first())
    }

    private fun loadState() {
        prefs.getString("seen", "")?.takeIf { it.isNotEmpty() }?.let { seen.addAll(it.split("\n")) }
        prefs.getString("favs", "")?.takeIf { it.isNotEmpty() }?.let { favs.addAll(it.split("\n")) }
        prefs.getString("scores", "")?.takeIf { it.isNotEmpty() }?.split("\n")?.forEach { line ->
            val i = line.lastIndexOf('\t')
            if (i > 0) line.substring(i + 1).toIntOrNull()?.let { scores[line.substring(0, i)] = it }
        }
        prefs.getString("hosts", "")?.takeIf { it.isNotEmpty() }?.split("\n")?.forEach { line ->
            val i = line.lastIndexOf('\t')
            if (i > 0) line.substring(i + 1).toIntOrNull()?.let { hostScores[line.substring(0, i)] = it }
        }
    }

    private fun saveState() {
        prefs.edit()
            .putString("seen", seen.joinToString("\n"))
            .putString("scores", scores.entries.joinToString("\n") { "${it.key}\t${it.value}" })
            .putString("hosts", hostScores.entries.joinToString("\n") { "${it.key}\t${it.value}" })
            .apply()
    }

    private fun saveFavs() {
        prefs.edit().putString("favs", favs.joinToString("\n")).apply()
    }

    override fun onPause() {
        super.onPause()
        saveState()
    }

    inner class Bridge {
        @JavascriptInterface
        fun onImages(token: Int, json: String) {
            val parsed = try {
                val arr = JSONArray(json)
                (0 until arr.length()).map {
                    val e = arr.getJSONArray(it)
                    Triple(e.getString(0), e.optInt(1, 0), e.optInt(2, 0))
                }
            } catch (e: Exception) { emptyList() }
            runOnUiThread {
                if (token == searchToken) {
                    dims.clear()
                    parsed.forEach { (u, h, w) -> dims[u] = h to w }
                }
                onImagesFound(token, parsed.map { it.first })
            }
        }

        @JavascriptInterface
        fun broken(i: Int) {
            // الصورة ما انفتحت (محمية أو محذوفة): نعبر للي بعدها بدون إعلان
            runOnUiThread {
                if (i != index || images.isEmpty()) return@runOnUiThread
                val h = hostOf(images[index])
                if (h.isNotEmpty()) hostScores[h] = ((hostScores[h] ?: 0) - 1).coerceIn(-5, 10)
                if (viewingFavs && images.size == 1) return@runOnUiThread
                showNext()
            }
        }
    }

    /** سكربت يستخرج روابط الصور الأصلية من صفحة صور جوجل، ويقدّم الصور الطولية (إطلالة كاملة) */
    private fun extractJs(token: Int) = """
(function(){
  var out=[], tall=[], seen={}, dim={};
  function add(u,h,w){
    if(!u||seen[u])return;
    if(u.indexOf('https://')!==0 && u.indexOf('data:image')!==0)return;
    seen[u]=1; out.push(u); dim[u]=[h||0,w||0];
  }
  var html=document.documentElement.innerHTML, m;
  var re=/\["(https:\/\/[^"]+?)",(\d+),(\d+)\]/g;
  while((m=re.exec(html))!==null){
    var u=m[1];
    try{ u=JSON.parse('"'+u+'"'); }catch(e){}
    if(/gstatic\.com|google\.|googleusercontent/.test(u))continue;
    var h=parseInt(m[2]), w=parseInt(m[3]);
    if(h<250||w<200)continue;
    add(u,h,w);
    if(h>=w*1.2) tall.push(u);
  }
  var re2=/imgurl=([^&"]+)/g;
  while((m=re2.exec(html))!==null){ try{ add(decodeURIComponent(m[1])); }catch(e){} }
  if(out.length<3){
    var imgs=document.images;
    for(var i=0;i<imgs.length;i++){ if(imgs[i].naturalWidth>=100) add(imgs[i].src,imgs[i].naturalHeight,imgs[i].naturalWidth); }
  }
  var res = tall.length>=10 ? tall : tall.concat(out.filter(function(x){return tall.indexOf(x)<0;}));
  Android.onImages(__T__, JSON.stringify(res.slice(0,100).map(function(x){return [x,dim[x][0],dim[x][1]];})));
})();
""".replace("__T__", token.toString())

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
