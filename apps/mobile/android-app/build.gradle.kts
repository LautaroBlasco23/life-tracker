plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.lifetracker.mobile"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.lifetracker.mobile"
        minSdk = 26
        targetSdk = 36
        // Must stay above any previously installed RN APK's versionCode so the
        // Kotlin app installs as an update over it (see plan.md Phase 6).
        versionCode = 100
        versionName = "2.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}


dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:i18n"))

    implementation(project(":feature:auth"))
    implementation(project(":feature:activities"))
    implementation(project(":feature:time"))
    implementation(project(":feature:notes"))
    implementation(project(":feature:finance"))
    implementation(project(":feature:social"))
    implementation(project(":feature:profile"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.activity.compose)
    implementation(libs.navigation.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.core.splashscreen)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.ui.tooling.preview)

    testImplementation(libs.junit)
}
