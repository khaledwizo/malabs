plugins {
    id("com.android.application")
}

val buildNum = (project.findProperty("vCode") as String?)?.toIntOrNull() ?: 0

android {
    namespace = "com.rafidain.front"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.rafidain.front"
        minSdk = 24
        targetSdk = 34
        versionCode = 100 + buildNum
        versionName = "1.0." + buildNum
    }
    // مفتاح توقيع ثابت (من ذاكرة GitHub المؤقتة) كي تُثبَّت كل نسخة جديدة فوق القديمة دون حذف
    signingConfigs {
        create("stable") {
            storeFile = file(System.getProperty("user.home") + "/.android/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("stable")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources { noCompress += listOf("html", "woff2") }
}
