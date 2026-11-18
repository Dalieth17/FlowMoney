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
    // Los repositorios se declaran solo aquí, nunca en los módulos.
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "FlowMoney"

// :domain → Kotlin puro (modelos, reglas, casos de uso). Sin dependencias de Android.
// :app    → Android: datos (Room), DI (Hilt) y presentación (Compose).
include(":app", ":domain")
