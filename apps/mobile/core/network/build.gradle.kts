plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.lifetracker.core.network"
    compileSdk = 37
    defaultConfig {
        minSdk = 26
    }

    // Baked-in fallback for `BuildConfig.API_BASE_URL` (NetworkModule): an
    // explicit `-PapiBaseUrl=<url>` wins over both. Debug defaults to the
    // emulator's host alias so `make mobile` works with zero configuration —
    // 10.0.2.2 rather than localhost because `adb reverse` mappings die with
    // the emulator. Release falls back to the production API.
    val apiProp = project.findProperty("apiBaseUrl") as String?
    buildTypes {
        debug {
            buildConfigField(
                "String", "API_BASE_URL",
                "\"${apiProp ?: "http://10.0.2.2:8080/api/"}\"",
            )
        }
        release {
            buildConfigField(
                "String", "API_BASE_URL",
                "\"${apiProp ?: "https://lifetracker.lautaroblasco.com.ar/api/"}\"",
            )
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":core:storage"))
    api(platform(libs.okhttp.bom))
    api(libs.retrofit)
    api(libs.retrofit.kotlinx)
    api(libs.okhttp)
    api(libs.okhttp.logging)
    api(libs.kotlinx.serialization.json)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}


kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
