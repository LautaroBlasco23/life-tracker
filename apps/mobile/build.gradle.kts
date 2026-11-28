// Top-level build file: declare plugins with `apply false`; modules apply them individually.
//
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.ksp) apply false

    // Unit-test coverage ratchet (Phase 6): the root aggregate `jacocoTestReport`
    // task below merges every module's JaCoCo execution data into one XML report.
    id("jacoco")
}

// Enable AGP's first-class unit-test coverage instrumentation on every Android
// module's debug variant. This makes `testDebugUnitTest` emit JaCoCo `.exec`
// files under `<module>/build/outputs/unit_test_code_coverage/debugUnitTest/`
// without each module having to configure anything itself.
subprojects {
    plugins.withId("com.android.library") {
        extensions.configure<com.android.build.gradle.LibraryExtension>("android") {
            buildTypes.getByName("debug") { enableUnitTestCoverage = true }
        }
    }
    plugins.withId("com.android.application") {
        extensions.configure<com.android.build.gradle.AppExtension>("android") {
            buildTypes.getByName("debug") { enableUnitTestCoverage = true }
        }
    }
}

/**
 * Aggregate XML/HTML coverage report across all Android modules
 * (`./gradlew jacocoTestReport`). Runs `testDebugUnitTest` everywhere it is
 * referenced from, then merges the `.exec` files produced by the
 * `enableUnitTestCoverage` instrumentation configured above.
 *
 * Task graph: `jacocoTestReport` -> each module's `testDebugUnitTest`
 * -> module compilation; the XML lands at
 * `apps/mobile/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml`.
 */
tasks.register<JacocoReport>("jacocoTestReport") {
    // String task paths so the references resolve lazily (modules may not be
    // evaluated yet when this root task is configured). Only real modules —
    // the intermediate `:core` / `:feature` holder projects have no tasks.
    dependsOn(
        subprojects
            .filter { it.projectDir.resolve("build.gradle.kts").exists() }
            .map { sub -> "${sub.path}:testDebugUnitTest" },
    )

    executionData.setFrom(
        fileTree(rootDir) {
            include("**/build/outputs/unit_test_code_coverage/debugUnitTest/*.exec")
        },
    )

    // Kotlin sources only (the whole mobile codebase is src/main/kotlin);
    // generated Java sources would show up under the same pattern if added.
    sourceDirectories.setFrom(
        files(subprojects.map { sub -> "${sub.projectDir}/src/main/kotlin" }),
    )

    classDirectories.setFrom(
        files(
            subprojects.map { sub ->
                fileTree("${sub.projectDir}/build/tmp/kotlin-classes/debug") {
                    // Build noise that never counts toward logic coverage.
                    exclude(
                        "**/R.class",
                        "**/R$*.class",
                        "**/Manifest*.*",
                        "**/BuildConfig.class",
                        // Hilt/KSP-generated glue.
                        "**/*_Hilt*.*",
                        "**/Hilt_*.*",
                        "**/Dagger*.*",
                        "**/*_Factory.*",
                        "**/*_Impl*.*",
                        "**/*Module_*.*",
                    )
                }
            },
        ),
    )

    reports {
        xml.required.set(true)
        xml.outputLocation.set(
            layout.buildDirectory.file("reports/jacoco/jacocoTestReport/jacocoTestReport.xml"),
        )
        html.required.set(true)
        html.outputLocation.set(
            layout.buildDirectory.dir("reports/jacoco/jacocoTestReport/html"),
        )
    }
}
