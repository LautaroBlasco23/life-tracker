plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.lifetracker.core.designsystem"
    compileSdk = 37
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}


dependencies {
    api(platform(libs.compose.bom))
    api(libs.compose.foundation)
    api(libs.compose.material3)
    api(libs.lifecycle.runtime.compose)
    implementation(libs.compose.ui)
    // Icons (material-icons-extended) — port of the lucide icons used by components/ui.
    implementation(libs.compose.material.icons)
    // Model-only import (StreakInfo) for LbStreakBadge — no API calls from this module.
    implementation(project(":core:network"))
    // `I18n.t` for intrinsic fallback labels (e.g. option-select "Cancel").
    implementation(project(":core:i18n"))

    testImplementation(libs.junit)
}


kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
