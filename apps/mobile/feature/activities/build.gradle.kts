plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.lifetracker.feature.activities"
    compileSdk = 37
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}


dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:i18n"))
    // Activities repositories (domain ports of the shared services) + the
    // wire models they return (domain does not expose its `implementation`
    // network dependency).
    implementation(project(":domain"))
    implementation(project(":core:network"))
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    // `hiltViewModel()` in the screen composable + lucide-icon stand-ins.
    implementation(libs.hilt.navigation.compose)
    implementation(libs.compose.material.icons)
}


kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
