plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.lifetracker.feature.profile"
    compileSdk = 37
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        // BuildConfig.DEBUG gates the https-only API-URL validation (RN `__DEV__`).
        buildConfig = true
    }
}


dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:i18n"))
    // Domain repositories (ProfileRepository, DataBackupRepository, AuthRepository)
    // + the shared CredentialsValidatorRepository for the email modal.
    implementation(project(":domain"))
    // Network model types surfaced through the repositories (UserResponse, …).
    implementation(project(":core:network"))
    implementation(project(":core:storage"))
    implementation(libs.compose.material.icons)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    // hiltViewModel() composable accessor for @HiltViewModel screen models.
    implementation(libs.hilt.navigation.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    // ActivityResult contracts: PickVisualMedia (avatar), CreateDocument (export),
    // OpenDocument (import).
    implementation(libs.activity.compose)
}


kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
