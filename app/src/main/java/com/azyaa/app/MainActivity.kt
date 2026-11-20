package com.azyaa.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import java.net.URLEncoder
import kotlin.random.Random

/**
 * أزياء البنات: يبحث بصور جوجل (البحث الآمن مقفول دائماً) داخل نافذة مخفية،
 * يستخرج روابط الصور، ويعرضها صورة صورة أو شبكة 9 صور.
 *
 * الذكاء بالتطبيق:
 *  - يركّب نص البحث من قطع (عمر + نوع اللبس + وضعية + طابع + نمط + لون...) بشكل عشوائي ذكي.
 *  - يتعلم من المفضلة والتنزيل والمشاركة: «ملف ذوق» للستايلات والألوان والوضعيات والطابع والمواقع.
 *  - «💡 حسب ذوقي»: يبحث تلقائياً باللي تحبه.  «✨ ترند الموسم»: يتبدل حسب الموسم ورمضان والعيد.
 *  - إذا ما طلعت نتائج يبسّط النص خطوة خطوة، وبالوضع التلقائي يبدّل اللغة.
 *  - «الأجمل أولاً»: يرتب حسب الدقة والإطلالة الكاملة والمواقع المفضلة، ويخلط المواقع حتى ما تتكرر.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val ALL = "الكل"
        const val FOR_YOU = "💡 حسب ذوقي"
        const val SEASON = "✨ ترند الموسم"
        const val LANG_AUTO = "تلقائي (عربي + English)"
        const val LANG_AR = "عربي"
        const val LANG_EN = "English"
        const val REQ_STORAGE = 7
    }

    /** كلمات بحث إنكليزية وعربية لكل خيار. key = كلمة عامة للبحث الاحتياطي */
    private class Opt(val en: List<String>, val ar: List<String>, val keyEn: String = "", val keyAr: String = "")

    // ===== الستايل: نوع الملابس =====
    // الإنكليزي: الكلمة المهمة بين "" حتى ما تختلط الأقسام
    // العربي: نص مختصر وشامل لأن نتائج العربي أقل
    private val styles = linkedMapOf(
        "صيفي" to Opt(
            listOf("\"summer\" outfit", "\"sundress\" outfit", "\"summer\" casual outfit", "\"linen\" summer outfit"),
            listOf("ملابس صيفية نسائية", "فستان صيفي", "اطلالات صيفية", "لبس صيفي"),
            "summer outfit", "ملابس صيفية نسائية"
        ),
        "فساتين قصيرة" to Opt(
            listOf("\"mini dress\" outfit", "\"short dress\" outfit", "\"mini dress\" street style", "satin \"mini dress\""),
            listOf("فستان قصير", "فساتين قصيرة", "فستان قصير ناعم"),
            "mini dress", "فساتين قصيرة"
        ),
        "كروب توب" to Opt(
            listOf("\"crop top\" outfit", "\"crop top\" and jeans", "\"crop top\" and skirt", "\"crop top\" street style"),
            listOf("كروب توب", "تنسيق كروب توب", "كروب توب مع جينز"),
            "crop top outfit", "كروب توب"
        ),
        "تنانير" to Opt(
            listOf("\"mini skirt\" outfit", "\"midi skirt\" outfit", "\"pleated skirt\" outfit", "\"denim skirt\" outfit"),
            listOf("تنورة قصيرة", "تنورة ميدي", "تنانير نسائية", "تنورة جينز"),
            "skirt outfit", "تنانير نسائية"
        ),
        "أوف شولدر" to Opt(
            listOf("\"off shoulder\" top outfit", "\"off shoulder\" dress", "\"off the shoulder\" outfit"),
            listOf("اوف شولدر", "فستان اوف شولدر", "بلوزة اوف شولدر"),
            "off shoulder outfit", "اوف شولدر"
        ),
        "جينز وكاجوال" to Opt(
            listOf("\"jeans\" casual outfit", "\"mom jeans\" outfit", "\"wide leg jeans\" outfit", "\"skinny jeans\" outfit"),
            listOf("تنسيق جينز نسائي", "ملابس كاجوال نسائية", "بنطلون جينز نسائي"),
            "jeans outfit", "ملابس كاجوال نسائية"
        ),
        "سهرة وحفلات" to Opt(
            listOf("\"party dress\"", "\"evening dress\"", "\"night out\" outfit", "\"cocktail dress\""),
            listOf("فساتين سهرة", "فستان حفلة", "فستان سواريه", "اطلالة سهرة"),
            "party dress", "فساتين سهرة"
        ),
        "أعراس وخطوبة" to Opt(
            listOf("\"engagement dress\"", "\"wedding guest\" dress", "\"bridal\" dress", "\"henna night\" dress"),
            listOf("فستان خطوبة", "فساتين أعراس", "فستان عروس", "فستان حنة"),
            "wedding dress", "فساتين أعراس"
        ),
        "فنتج" to Opt(
            listOf("\"vintage\" outfit", "\"70s\" fashion outfit", "\"90s\" fashion outfit", "\"retro\" outfit"),
            listOf("ستايل فنتج", "ملابس فنتج", "موضة التسعينات"),
            "vintage outfit", "ستايل فنتج"
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
        "ملابس سباحة / بيكيني" to Opt(
            listOf("\"bikini\" swimwear fashion", "\"one piece swimsuit\" fashion", "\"swimwear\" collection"),
            listOf("ملابس سباحة نسائية", "مايوه نسائي"),
            "swimwear fashion", "ملابس سباحة نسائية"
        ),
        "بوركيني" to Opt(
            listOf("\"burkini\"", "\"burkini\" swimwear", "\"modest swimsuit\"", "\"burkini\" beach"),
            listOf("بوركيني", "مايوه شرعي", "مايوه محجبات"),
            "burkini", "بوركيني"
        ),
        "شتوي" to Opt(
            listOf("\"winter outfit\"", "\"wool coat\" outfit", "\"puffer jacket\" outfit",
                "\"knit sweater\" outfit", "\"trench coat\" outfit"),
            listOf("ملابس شتوية نسائية", "معطف نسائي", "جاكيت شتوي نسائي", "اطلالات شتوية"),
            "women winter outfit", "ملابس شتوية نسائية"
        ),
        "رسمي / عمل" to Opt(
            listOf("\"office outfit\"", "\"business attire\"", "\"pant suit\" outfit",
                "\"blazer\" office outfit", "\"workwear\" outfit"),
            listOf("ملابس رسمية نسائية", "لبس دوام نسائي", "بدلة نسائية", "بليزر نسائي"),
            "women office outfit", "ملابس رسمية نسائية"
        ),
        "فساتين طويلة" to Opt(
            listOf("\"maxi dress\" outfit", "long sleeve \"maxi dress\"",
                "floral \"maxi dress\"", "satin \"maxi dress\""),
            listOf("فساتين طويلة", "فستان طويل", "فساتين سهرة طويلة"),
            "maxi dress", "فساتين طويلة"
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
        "محتشم" to Opt(
            listOf("\"modest\" outfit", "\"modest\" maxi skirt outfit", "\"modest\" wide leg pants outfit",
                "\"modest\" fashion look"),
            listOf("ملابس محتشمة", "لبس محتشم", "اطلالات محتشمة"),
            "modest outfit", "ملابس محتشمة"
        )
    )
    private val styleChoices = listOf(FOR_YOU, SEASON) + styles.keys

    // ===== الطابع: موضة من بلدان مختلفة =====
    private val regions = linkedMapOf(
        ALL to Opt(listOf(""), listOf("")),
        "عربي / خليجي" to Opt(listOf("arab fashion", "gulf style fashion"), listOf("موضة خليجية", "ستايل عربي")),
        "تركي" to Opt(listOf("turkish fashion", "istanbul street style"), listOf("موضة تركية", "ستايل تركي")),
        "كوري" to Opt(listOf("korean fashion", "k-fashion"), listOf("ستايل كوري", "موضة كورية")),
        "باريسي" to Opt(listOf("parisian chic", "french style"), listOf("ستايل باريسي", "موضة فرنسية")),
        "إيطالي" to Opt(listOf("italian fashion", "milan street style"), listOf("موضة إيطالية", "ستايل إيطالي")),
        "أمريكي" to Opt(listOf("american street style", "new york street style"), listOf("ستايل أمريكي", "موضة أمريكية"))
    )

    // ===== النمط: طريقة التصوير =====
    private val modes = linkedMapOf(
        ALL to Opt(listOf(""), listOf("")),
        "ستوديو" to Opt(listOf("studio photoshoot", "lookbook photoshoot"), listOf("ستوديو", "لوك بوك")),
        "شارع" to Opt(listOf("street style", "outdoor photo"), listOf("ستريت ستايل", "تصوير خارجي")),
        "إطلالة كاملة" to Opt(listOf("full body"), listOf("اطلالة كاملة"))
    )

    // ===== الوضعية / المكان =====
    private val poses = linkedMapOf(
        ALL to Opt(listOf(""), listOf("")),
        "واقفة" to Opt(listOf("standing pose", "standing"), listOf("واقفة", "وقفة")),
        "تمشي" to Opt(listOf("walking pose", "walking in street"), listOf("تمشي", "مشية")),
        "جالسة (كنبة / كرسي)" to Opt(listOf("sitting on sofa", "sitting on chair", "sitting pose"),
            listOf("جالسة على كنبة", "جالسة على كرسي", "جلسة")),
        "جانبية" to Opt(listOf("side profile pose", "side view outfit"), listOf("وقفة جانبية", "صورة جانبية")),
        "سيلفي مراية" to Opt(listOf("mirror selfie outfit", "mirror selfie"), listOf("سيلفي مراية", "سيلفي بالمراية")),
        "كافيه" to Opt(listOf("cafe photoshoot", "coffee shop outfit"), listOf("كافيه", "بالكافيه")),
        "بالطبيعة" to Opt(listOf("garden photoshoot", "nature photoshoot"), listOf("بالطبيعة", "حديقة")),
        "بالبحر" to Opt(listOf("beach photoshoot", "seaside outfit"), listOf("بالبحر", "على الشاطئ")),
        "سفر" to Opt(listOf("travel outfit photo", "vacation outfit"), listOf("ملابس سفر", "اطلالة سفر")),
        "بالمدينة ليلاً" to Opt(listOf("city night photoshoot", "night street style"), listOf("تصوير ليلي", "بالليل"))
    )

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

    private val langs = listOf(LANG_AUTO, LANG_AR, LANG_EN)

    // قطع إضافية للتنويع
    private val fullBodyEn = listOf("full body", "full length photo", "head to toe")
    private val fullBodyAr = listOf("اطلالة كاملة", "")
    private val adjEn = listOf("elegant", "casual", "chic", "trendy", "classy", "minimal", "2026")
    private val adjAr = listOf("كاجوال", "راقي", "ترند", "ناعم")
    private val colorsEn = listOf("black", "white", "beige", "pink", "blue", "green", "red", "brown", "navy", "olive", "grey", "burgundy")
    private val colorsAr = listOf("أسود", "أبيض", "بيج", "وردي", "أزرق", "أخضر", "أحمر", "بني", "كحلي")

    // فلاتر جوجل العشوائية (صور كبيرة، صور فوتوغرافية، آخر سنة...)
    private val tbsOptions = listOf("", "", "isz:l", "itp:photo", "qdr:y")

    // استبعاد: الأطفال والمراهقات، الرجال، وصور المنتجات بدون لابسة
    private val excludeEn =
        "-kids -kid -child -children -baby -toddler -teen -teens -girl -girls -boy -boys -men -man " +
        "-mannequin -flatlay -hanger -product -shampoo"
    private val excludeAr = "-أطفال -طفلة -بناتي -ولادي -رجالي -عجوز"

    private lateinit var spStyle: Spinner
    private lateinit var spRegion: Spinner
    private lateinit var spMode: Spinner
    private lateinit var spPose: Spinner
    private lateinit var spLang: Spinner
    private lateinit var spAge: Spinner
    private lateinit var panelOptions: View
    private lateinit var web: WebView        // يعرض صورة وحدة أو شبكة
    private lateinit var searchWeb: WebView  // مخفي خلف العرض: يفتح صور جوجل ويستخرج الروابط
    private lateinit var progress: ProgressBar
    private lateinit var txtCredit: TextView
    private lateinit var btnOpen: Button
    private lateinit var btnFav: Button
    private lateinit var btnFavs: Button
    private lateinit var btnShare: Button
    private lateinit var btnDownload: Button
    private lateinit var btnGrid: Button
    private lateinit var btnPanel: Button
    private lateinit var ads: Ads

    private val handler = Handler(Looper.getMainLooper())
    private var images: List<String> = emptyList()
    private var index = 0
    private var searchToken = 0
    private var loadedToken = -1
    private var extractTries = 0
    private var gridMode = false
    private var sortBest = true
    private var pendingDownload: String? = null

    // حالة البحث الحالي
    private var searchArabic = Random.nextBoolean()
    private var level = 0          // 0 = نص كامل، 1 = أبسط، 2 = أبسط، 3 = كلمة عامة
    private var retryRounds = 0    // كم مرة أعاد البحث بهاي الدفعة
    private var langSwitched = false
    private var currentItem = ""   // الكلمة الأساسية المستخدمة (للتعلم)
    private var currentParts: List<String> = emptyList()
    private var currentLabel = ""
    private var activeStyle = ""   // الستايل الفعلي (حتى مع «حسب ذوقي»)
    private var activePose = ALL
    private var activeRegion = ALL
    private var activeMode = ALL
    private var activeColor = ""
    private var seasonName = ""
    private var tasteHintShown = false
    private val recentQueries = ArrayDeque<String>()

    // الصور اللي ظهرت سابقاً (تنحفظ حتى بعد سد التطبيق) حتى ما تتكرر
    private val seen = LinkedHashSet<String>()
    private val maxSeen = 5000

    // المفضلة
    private val favs = mutableListOf<String>()
    private var viewingFavs = false

    // ===== الذكاء =====
    private val scores = HashMap<String, Int>()      // نقاط كلمات البحث
    private val hostScores = HashMap<String, Int>()  // نقاط المواقع
    private val taste = HashMap<String, Int>()       // ملف الذوق: s: ستايل، p: وضعية، r: طابع، m: نمط، c: لون
    private val dims = HashMap<String, Pair<Int, Int>>() // أبعاد صور الدفعة (طول، عرض)

    private val prefs by lazy { getSharedPreferences("azyaa", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        spStyle = findViewById(R.id.spStyle)
        spRegion = findViewById(R.id.spRegion)
        spMode = findViewById(R.id.spMode)
        spPose = findViewById(R.id.spPose)
        spLang = findViewById(R.id.spLang)
        spAge = findViewById(R.id.spAge)
        panelOptions = findViewById(R.id.panelOptions)
        web = findViewById(R.id.web)
        searchWeb = findViewById(R.id.searchWeb)
        progress = findViewById(R.id.progress)
        txtCredit = findViewById(R.id.txtCredit)
        btnOpen = findViewById(R.id.btnOpen)
        btnFav = findViewById(R.id.btnFav)
        btnFavs = findViewById(R.id.btnFavs)
        btnShare = findViewById(R.id.btnShare)
        btnDownload = findViewById(R.id.btnDownload)
        btnGrid = findViewById(R.id.btnGrid)
        btnPanel = findViewById(R.id.btnPanel)

        loadState()

        setup(spStyle, styleChoices, "style")
        setup(spRegion, regions.keys.toList(), "region")
        setup(spPose, poses.keys.toList(), "pose")
        setup(spMode, modes.keys.toList(), "mode")
        setup(spAge, ages.keys.toList(), "age")
        setup(spLang, langs, "lang")
        updateFavsButton()
        updateGridButton()

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
            ads.showRewardedInterstitial { setPanel(false); startNewBatch() }
        }
        findViewById<Button>(R.id.btnSurprise).setOnClickListener {
            // اختيار عشوائي للستايل والطابع والوضعية والنمط
            spStyle.setSelection(Random.nextInt(styleChoices.size))
            spRegion.setSelection(Random.nextInt(regions.size))
            spPose.setSelection(Random.nextInt(poses.size))
            spMode.setSelection(Random.nextInt(modes.size))
            ads.showRewardedInterstitial { setPanel(false); startNewBatch() }
        }
        findViewById<Button>(R.id.btnRefresh).setOnClickListener {
            if (images.isEmpty()) { startNewBatch(); return@setOnClickListener }
            ads.showRewardedVideo(
                onReward = { showNext() },
                onNotWatched = { Toast.makeText(this, "شاهد الإعلان كاملاً حتى تتبدل الصورة", Toast.LENGTH_SHORT).show() }
            )
        }
        btnGrid.setOnClickListener {
            gridMode = !gridMode
            updateGridButton()
            if (images.isNotEmpty()) {
                if (gridMode) index = (index / 9) * 9
                showCurrent()
            }
        }
        btnPanel.setOnClickListener { setPanel(panelOptions.visibility != View.VISIBLE) }
        findViewById<Button>(R.id.btnTaste).setOnClickListener { showTaste() }

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
            rewardTaste(1)
        }
        btnDownload.setOnClickListener { downloadCurrent() }
        btnFav.setOnClickListener { toggleFav() }
        btnFavs.setOnClickListener { openFavs() }
    }

    /** يربط القائمة ويحفظ آخر اختيار */
    private fun setup(sp: Spinner, items: List<String>, key: String) {
        sp.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, items)
        sp.setSelection(prefs.getInt(key, 0).coerceIn(0, items.size - 1))
        sp.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                prefs.edit().putInt(key, pos).apply()
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun setPanel(show: Boolean) {
        panelOptions.visibility = if (show) View.VISIBLE else View.GONE
        btnPanel.text = if (show) "⚙️ إخفاء ▴" else "⚙️ الخيارات ▾"
    }

    // ================= ترند الموسم =================

    /** يختار ترند حسب الوقت: رمضان، العيد، رأس السنة، أو فصل السنة */
    private fun seasonOpt(): Opt {
        val cal = java.util.Calendar.getInstance()
        val year = cal.get(java.util.Calendar.YEAR)
        try {
            val ic = android.icu.util.IslamicCalendar()
            val m = ic.get(android.icu.util.Calendar.MONTH)
            val d = ic.get(android.icu.util.Calendar.DAY_OF_MONTH)
            // أشهر التقويم الهجري تبدي من 0: رمضان = 8، شوال = 9، ذو الحجة = 11
            if ((m == 8 && d >= 22) || (m == 9 && d <= 5) || (m == 11 && d in 5..14)) {
                seasonName = "العيد"
                return Opt(listOf("\"eid\" outfit", "\"eid\" dress", "\"eid\" outfit $year"),
                    listOf("ملابس العيد", "فستان العيد", "اطلالات العيد $year"), "eid outfit", "ملابس العيد")
            }
            if (m == 8) {
                seasonName = "رمضان"
                return Opt(listOf("\"ramadan\" outfit", "\"ramadan\" dress", "\"iftar\" outfit"),
                    listOf("اطلالات رمضان", "فستان رمضاني", "جلابية رمضان"), "ramadan outfit", "اطلالات رمضان")
            }
        } catch (_: Throwable) { }
        val month = cal.get(java.util.Calendar.MONTH)   // 0 = كانون الثاني
        val day = cal.get(java.util.Calendar.DAY_OF_MONTH)
        if ((month == 11 && day >= 20) || (month == 0 && day <= 2)) {
            seasonName = "رأس السنة"
            return Opt(listOf("\"new year's eve\" outfit", "\"new year\" party dress", "sparkly party outfit"),
                listOf("فستان رأس السنة", "اطلالة حفلة رأس السنة", "فستان سهرة لامع"), "new year outfit", "فستان رأس السنة")
        }
        return when (month) {
            11, 0, 1 -> {
                seasonName = "الشتاء"
                Opt(listOf("\"winter\" outfit $year", "\"winter\" fashion trend", "\"winter\" outfit ideas"),
                    listOf("موضة شتاء $year", "اطلالات شتوية", "ملابس شتوية ترند"), "winter outfit", "اطلالات شتوية")
            }
            2, 3, 4 -> {
                seasonName = "الربيع"
                Opt(listOf("\"spring\" outfit $year", "\"spring\" fashion trend", "\"spring\" outfit ideas"),
                    listOf("موضة الربيع $year", "اطلالات ربيعية", "ملابس ربيعية"), "spring outfit", "اطلالات ربيعية")
            }
            5, 6, 7, 8 -> {
                seasonName = "الصيف"
                Opt(listOf("\"summer\" outfit $year", "\"summer\" fashion trend", "\"summer\" outfit ideas"),
                    listOf("موضة الصيف $year", "اطلالات صيفية", "ملابس صيفية ترند"), "summer outfit", "اطلالات صيفية")
            }
            else -> {
                seasonName = "الخريف"
                Opt(listOf("\"fall\" outfit $year", "\"autumn\" fashion trend", "\"fall\" outfit ideas"),
                    listOf("موضة الخريف $year", "اطلالات خريفية", "ملابس خريفية"), "fall outfit", "اطلالات خريفية")
            }
        }
    }

    // ================= محرك البحث الذكي =================

    private fun langMode(): String = spLang.selectedItem as String

    /** يختار كلمة من القائمة؛ الكلمات اللي جابت نتائج جيدة أو عجبتك إلها فرصة أكبر */
    private fun pickWeighted(items: List<String>): String {
        if (items.size <= 1) return items.firstOrNull() ?: ""
        val w = items.map { (1.0 + (scores[it] ?: 0) * 0.35).coerceIn(0.15, 4.0) }
        var r = Random.nextDouble() * w.sum()
        for (i in items.indices) { r -= w[i]; if (r <= 0) return items[i] }
        return items.last()
    }

    /** يختار من ملف ذوقك (حسب عدد المرات اللي عجبك بيها الشي) */
    private fun pickByTaste(prefix: String, options: List<String>): String? {
        val c = options.map { it to (taste[prefix + it] ?: 0) }.filter { it.second > 0 }
        if (c.isEmpty()) return null
        var r = Random.nextInt(c.sumOf { it.second })
        for ((k, v) in c) { r -= v; if (r < 0) return k }
        return c.last().first
    }

    private fun learn(item: String, delta: Int) {
        if (item.isEmpty()) return
        scores[item] = ((scores[item] ?: 0) + delta).coerceIn(-5, 8)
    }

    /** الستايل الفعلي للبحث (مع «حسب ذوقي» و«ترند الموسم») */
    private fun resolveStyle(): Pair<String, Opt> {
        return when (val sel = spStyle.selectedItem as String) {
            SEASON -> SEASON to seasonOpt()
            FOR_YOU -> {
                val name = pickByTaste("s:", styles.keys.toList()) ?: styles.keys.random()
                name to (styles[name] ?: styles.values.first())
            }
            else -> sel to (styles[sel] ?: styles.values.first())
        }
    }

    private fun styleLabel(): String = when (spStyle.selectedItem as String) {
        FOR_YOU -> "💡 $activeStyle"
        SEASON -> "✨ $seasonName"
        else -> activeStyle
    }

    /** يبني نص البحث حسب اللغة ومستوى التبسيط */
    private fun buildQuery(arabic: Boolean, lvl: Int): String {
        val forYou = spStyle.selectedItem as String == FOR_YOU
        val (styleName, st) = resolveStyle()
        activeStyle = styleName
        if (forYou && taste.isEmpty() && !tasteHintShown) {
            tasteHintShown = true
            Toast.makeText(this, "احفظ الصور اللي تعجبك بالمفضلة حتى أتعلم ذوقك 💡", Toast.LENGTH_LONG).show()
        }
        var poseName = spPose.selectedItem as String
        if (forYou && poseName == ALL && Random.nextInt(100) < 60)
            poseName = pickByTaste("p:", poses.keys.filter { it != ALL }) ?: ALL
        var regionName = spRegion.selectedItem as String
        if (forYou && regionName == ALL && Random.nextInt(100) < 50)
            regionName = pickByTaste("r:", regions.keys.filter { it != ALL }) ?: ALL
        val modeName = spMode.selectedItem as String
        activePose = poseName; activeRegion = regionName; activeMode = modeName

        val ps = poses[poseName] ?: poses.values.first()
        val rg = regions[regionName] ?: regions.values.first()
        val md = modes[modeName] ?: modes.values.first()
        val ag = ages[spAge.selectedItem as String] ?: ages.values.first()
        val colors = if (arabic) colorsAr else colorsEn

        var q = ""
        for (attempt in 0 until 15) {
            val parts = mutableListOf<String>()
            activeColor = ""
            if (lvl == 0 && Random.nextInt(100) < (if (forYou) 50 else 25)) {
                activeColor = (if (forYou) pickByTaste("c:", colors) else null) ?: pickWeighted(colors)
            }
            if (arabic) {
                // العربي: مختصر وشامل
                currentItem = if (lvl >= 3) st.keyAr else pickWeighted(st.ar)
                parts.add(currentItem)
                if (lvl <= 1) { parts.add(pickWeighted(ps.ar)); parts.add(pickWeighted(rg.ar)) }
                if (lvl == 0) {
                    if (Random.nextInt(100) < 60) parts.add(pickWeighted(ag.ar))
                    if (Random.nextInt(100) < 35) parts.add(fullBodyAr.random())
                    if (Random.nextInt(100) < 25) parts.add(pickWeighted(md.ar))
                    if (activeColor.isNotEmpty()) parts.add(activeColor)
                    else if (Random.nextInt(100) < 15) parts.add(pickWeighted(adjAr))
                }
            } else {
                currentItem = if (lvl >= 3) st.keyEn else pickWeighted(st.en)
                when (lvl) {
                    0 -> {
                        parts.add(pickWeighted(ag.en)); parts.add(currentItem)
                        parts.add(fullBodyEn.random()); parts.add(pickWeighted(ps.en))
                        parts.add(pickWeighted(rg.en)); parts.add(pickWeighted(md.en))
                        if (activeColor.isNotEmpty()) parts.add(activeColor)
                        if (Random.nextInt(100) < 20) parts.add(pickWeighted(adjEn))
                    }
                    1 -> {
                        parts.add("woman wearing"); parts.add(currentItem)
                        parts.add(pickWeighted(ps.en)); parts.add(pickWeighted(rg.en))
                    }
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
        setImageButtons(false)
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
     * «الأجمل أولاً»: نقاط لكل صورة حسب الدقة، الصورة الطولية (إطلالة كاملة)،
     * والمواقع اللي عجبتك صورها. وبعدين نخلط المواقع حتى ما تجي صور ورا بعض من نفس الموقع.
     */
    private fun rank(list: List<String>): List<String> {
        if (!sortBest) return list.shuffled()
        val sorted = list.map { u ->
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
        return diversify(sorted)
    }

    private fun diversify(list: List<String>): List<String> {
        val pool = list.toMutableList()
        val out = ArrayList<String>(list.size)
        var lastHost = ""
        while (pool.isNotEmpty()) {
            val j = (0 until minOf(5, pool.size)).firstOrNull { hostOf(pool[it]) != lastHost } ?: 0
            val u = pool.removeAt(j)
            out.add(u)
            lastHost = hostOf(u)
        }
        return out
    }

    // ================= التعلم من ذوقك =================

    /** لما تحفظ أو تنزل أو تشارك صورة: نزيد نقاط كل شي جابها */
    private fun rewardTaste(w: Int) {
        if (viewingFavs) return
        fun inc(k: String) { taste[k] = ((taste[k] ?: 0) + w).coerceAtMost(500) }
        if (activeStyle.isNotEmpty() && activeStyle != SEASON) inc("s:$activeStyle")
        if (activePose != ALL) inc("p:$activePose")
        if (activeRegion != ALL) inc("r:$activeRegion")
        if (activeMode != ALL) inc("m:$activeMode")
        if (activeColor.isNotEmpty()) inc("c:$activeColor")
        learn(currentItem, w + 1)
        currentParts.forEach { learn(it, 1) }
        saveState()
    }

    private fun showTaste() {
        fun top(prefix: String, n: Int = 4): String {
            val l = taste.entries.filter { it.key.startsWith(prefix) && it.value > 0 }
                .sortedByDescending { it.value }.take(n).map { it.key.removePrefix(prefix) }
            return if (l.isEmpty()) "—" else l.joinToString("، ")
        }
        val topHosts = hostScores.entries.filter { it.value > 0 }
            .sortedByDescending { it.value }.take(3).joinToString("، ") { it.key }
        val msg = buildString {
            append("👗 الستايلات اللي تحبها: ").append(top("s:")).append("\n\n")
            append("🎨 الألوان: ").append(top("c:")).append("\n\n")
            append("📸 الوضعيات والأماكن: ").append(top("p:")).append("\n\n")
            append("🌍 الطابع: ").append(top("r:")).append("\n\n")
            append("🌐 مواقع صورها تعجبك: ").append(if (topHosts.isEmpty()) "—" else topHosts).append("\n\n")
            append("⭐ صورك المحفوظة: ").append(favs.size).append("   👁 الصور اللي شفتها: ").append(seen.size).append("\n\n")
            append("ترتيب الصور: ").append(if (sortBest) "✨ الأجمل أولاً" else "🎲 عشوائي")
            if (taste.isEmpty()) append("\n\n💡 احفظ أو نزّل أو شارك الصور اللي تعجبك، وأنا أتعلم ذوقك وأجيبلك أشباهها من خيار «حسب ذوقي».")
        }
        AlertDialog.Builder(this)
            .setTitle("🧠 ملف ذوقك")
            .setMessage(msg)
            .setPositiveButton("تمام", null)
            .setNeutralButton(if (sortBest) "الترتيب عشوائي 🎲" else "الأجمل أولاً ✨") { _, _ ->
                sortBest = !sortBest
                prefs.edit().putBoolean("sortBest", sortBest).apply()
                Toast.makeText(this, if (sortBest) "صار الترتيب: الأجمل أولاً ✨" else "صار الترتيب: عشوائي 🎲", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("مسح التعلم") { _, _ ->
                AlertDialog.Builder(this)
                    .setMessage("أمسح كل اللي تعلمته عن ذوقك؟ (المفضلة تبقى)")
                    .setPositiveButton("إي امسح") { _, _ ->
                        taste.clear(); scores.clear(); hostScores.clear(); saveState()
                        Toast.makeText(this, "انمسح التعلم وبدينا من جديد", Toast.LENGTH_SHORT).show()
                    }
                    .setNegativeButton("لا", null)
                    .show()
            }
            .show()
    }

    // ================= العرض =================

    private fun esc(u: String) = u.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")

    private fun setImageButtons(on: Boolean, https: Boolean = true) {
        btnFav.isEnabled = on && https
        btnShare.isEnabled = on && https
        btnDownload.isEnabled = on && https
        btnOpen.isEnabled = on
    }

    private fun showCurrent() {
        if (gridMode) { showGrid(); return }
        val u = images.getOrNull(index) ?: return
        if (!viewingFavs) markSeen(u)
        val html = "<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
                "<style>html,body{margin:0;height:100%;background:#111;display:flex;" +
                "align-items:center;justify-content:center}" +
                "img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>" +
                "<img referrerpolicy=\"no-referrer\" src=\"${esc(u)}\" onerror=\"Android.broken($index)\">" +
                "</body></html>"
        web.loadDataWithBaseURL("https://www.google.com/", html, "text/html", "UTF-8", null)
        txtCredit.text = if (viewingFavs) "⭐ المفضلة • ${index + 1}/${images.size}"
        else styleLabel() +
                (if (activePose != ALL) " • $activePose" else "") +
                (if (activeRegion != ALL) " • $activeRegion" else "") +
                " • $currentLabel • ${index + 1}/${images.size}"
        setImageButtons(true, u.startsWith("https://"))
        btnFav.text = if (u in favs) "❤️ محفوظة" else "🤍 حفظ"
    }

    /** شبكة 9 صور؛ اضغط على أي صورة تكبر */
    private fun showGrid() {
        if (images.isEmpty()) return
        val end = minOf(index + 9, images.size)
        val sb = StringBuilder()
        sb.append("<html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">")
        sb.append("<style>html,body{margin:0;background:#111}")
        sb.append(".g{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:3px}")
        sb.append(".g div{height:calc((100vh - 12px)/3);overflow:hidden;background:#222;border-radius:6px}")
        sb.append(".g img{width:100%;height:100%;object-fit:cover}</style></head><body><div class=\"g\">")
        for (i in index until end) {
            val u = images[i]
            if (!viewingFavs) markSeen(u)
            sb.append("<div onclick=\"Android.pick(").append(i).append(")\">")
                .append("<img referrerpolicy=\"no-referrer\" src=\"").append(esc(u))
                .append("\" onerror=\"this.parentNode.style.display='none'\"></div>")
        }
        sb.append("</div></body></html>")
        web.loadDataWithBaseURL("https://www.google.com/", sb.toString(), "text/html", "UTF-8", null)
        txtCredit.text = (if (viewingFavs) "⭐ المفضلة" else "▦ ${styleLabel()} • $currentLabel") +
                " • ${index + 1}-$end من ${images.size} • اضغط على صورة تكبر"
        setImageButtons(false)
        btnOpen.isEnabled = false
    }

    private fun updateGridButton() {
        btnGrid.text = if (gridMode) "▢ صورة" else "▦ شبكة"
    }

    /** الصورة (أو الشبكة) اللي بعدها، وإذا خلصت يسوي دفعة جديدة بنص جديد */
    private fun showNext() {
        index += if (gridMode) 9 else 1
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
            Toast.makeText(this, "انشالت من المفضلة", Toast.LENGTH_SHORT).show()
        } else {
            favs.add(u)
            rewardTaste(2)
            val h = hostOf(u)
            if (h.isNotEmpty()) hostScores[h] = ((hostScores[h] ?: 0) + 2).coerceIn(-5, 10)
            Toast.makeText(this, "انحفظت بالمفضلة ⭐ (راح أجيبلك صور تشبهها أكثر)", Toast.LENGTH_SHORT).show()
        }
        saveFavs()
        saveState()
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

    // ================= التنزيل =================

    private fun downloadCurrent() {
        val u = images.getOrNull(index) ?: return
        if (!u.startsWith("https://")) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = u
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), REQ_STORAGE)
            return
        }
        enqueueDownload(u)
    }

    private fun enqueueDownload(u: String) {
        try {
            val path = (Uri.parse(u).lastPathSegment ?: "").lowercase()
            val ext = listOf("jpg", "jpeg", "png", "webp", "gif").firstOrNull { path.endsWith(".$it") } ?: "jpg"
            val name = "azyaa_${System.currentTimeMillis()}.$ext"
            val req = DownloadManager.Request(Uri.parse(u))
                .setTitle("أزياء البنات")
                .setDescription("تنزيل صورة")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_PICTURES, name)
                .addRequestHeader("User-Agent", WebSettings.getDefaultUserAgent(this))
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            Toast.makeText(this, "جاري التنزيل ⬇️ تلگاها بالمعرض (Pictures)", Toast.LENGTH_SHORT).show()
            rewardTaste(1)
            val h = hostOf(u)
            if (h.isNotEmpty()) hostScores[h] = ((hostScores[h] ?: 0) + 1).coerceIn(-5, 10)
        } catch (e: Exception) {
            Toast.makeText(this, "ما كدرت أنزل هاي الصورة، جرب 🌐 فتح", Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_STORAGE) return
        val u = pendingDownload
        pendingDownload = null
        if (u != null && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) enqueueDownload(u)
        else Toast.makeText(this, "لازم تسمح بالتخزين حتى أنزل الصور", Toast.LENGTH_SHORT).show()
    }

    // ================= الحفظ =================

    private fun markSeen(url: String) {
        seen.remove(url)
        seen.add(url)
        while (seen.size > maxSeen) seen.remove(seen.first())
    }

    private fun loadMap(key: String, into: HashMap<String, Int>) {
        prefs.getString(key, "")?.takeIf { it.isNotEmpty() }?.split("\n")?.forEach { line ->
            val i = line.lastIndexOf('\t')
            if (i > 0) line.substring(i + 1).toIntOrNull()?.let { into[line.substring(0, i)] = it }
        }
    }

    private fun mapStr(m: Map<String, Int>) = m.entries.joinToString("\n") { "${it.key}\t${it.value}" }

    private fun loadState() {
        prefs.getString("seen", "")?.takeIf { it.isNotEmpty() }?.let { seen.addAll(it.split("\n")) }
        prefs.getString("favs", "")?.takeIf { it.isNotEmpty() }?.let { favs.addAll(it.split("\n")) }
        loadMap("scores", scores)
        loadMap("hosts", hostScores)
        loadMap("taste", taste)
        sortBest = prefs.getBoolean("sortBest", true)
    }

    private fun saveState() {
        prefs.edit()
            .putString("seen", seen.joinToString("\n"))
            .putString("scores", mapStr(scores))
            .putString("hosts", mapStr(hostScores))
            .putString("taste", mapStr(taste))
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
                if (gridMode || i != index || images.isEmpty()) return@runOnUiThread
                val h = hostOf(images[index])
                if (h.isNotEmpty()) hostScores[h] = ((hostScores[h] ?: 0) - 1).coerceIn(-5, 10)
                if (viewingFavs && images.size == 1) return@runOnUiThread
                showNext()
            }
        }

        @JavascriptInterface
        fun pick(i: Int) {
            // من الشبكة: تكبير الصورة المختارة
            runOnUiThread {
                if (i in images.indices) {
                    gridMode = false
                    updateGridButton()
                    index = i
                    showCurrent()
                }
            }
        }
    }

    /** سكربت يستخرج روابط الصور وأبعادها من صفحة صور جوجل، ويقدّم الصور الطولية (إطلالة كاملة) */
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
