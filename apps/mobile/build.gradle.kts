// Top-level build file: declare plugins with `apply false`; modules apply them individually.
//
// AGP 9.x provides built-in Kotlin (no org.jetbrains.kotlin.android), with a
// runtime dependency on KGP. Declaring KGP + KSP here upgrades that runtime
// dependency from AGP's default (2.2.10) to the pinned version, keeping the
// Compose compiler + serialization plugins (which carry the same Kotlin
// version) consistent.
buildscript {
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${libs.versions.kotlin.get()}")
        classpath("com.google.devtools.ksp:symbol-processing-gradle-plugin:${libs.versions.ksp.get()}")
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.ksp) apply false
}
