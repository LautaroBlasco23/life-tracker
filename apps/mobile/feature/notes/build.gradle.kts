plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.lifetracker.feature.notes"
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
    // NotesRepository + NoteDraftStore (domain port of the shared services).
    implementation(project(":domain"))
    // Wire models surfaced through the repository + drag/markdown support.
    implementation(project(":core:network"))

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    // hiltViewModel() composable accessor for the @HiltViewModel screen model.
    implementation(libs.hilt.navigation.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    // Lucide-icon stand-ins (monitor-heart / sticky-note / ... nav icons).
    implementation(libs.compose.material.icons)
    // Drag-reorder for the notes/groups list (RN draggable-flatlist port).
    implementation(libs.reorderable)
    // Markdown rendering in the note editor preview (RN markdown-display port).
    implementation(libs.richtext.commonmark)
}


kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
