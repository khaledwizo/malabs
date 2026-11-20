plugins {
    id("com.android.application")
}

val buildNum = (project.findProperty("vCode") as String?)?.toIntOrNull() ?: 0

android {
    namespace = "com.nabd.bells"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nabd.bells"
        minSdk = 24
        targetSdk = 34
        versionCode = 300 + buildNum
        versionName = "3.0." + buildNum
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    androidResources { noCompress += listOf("html", "woff2") }
}
