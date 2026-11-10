pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "LifeTracker"

// The Kotlin Android app module lives in `android-app/` so it can never be
// confused with expo-router's `app/` routes folder (RN sources remain until
// Phase 6 cutover; see plan.md).
include(":app")
project(":app").projectDir = file("android-app")

include(":core:network")
include(":core:storage")
include(":core:designsystem")
include(":core:i18n")
include(":domain")

include(":feature:auth")
include(":feature:activities")
include(":feature:time")
include(":feature:notes")
include(":feature:finance")
include(":feature:social")
include(":feature:profile")
