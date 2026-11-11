import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Capa de dominio: Kotlin puro. Si alguien intenta usar una clase de Android aquí,
// no compila — así la regla de Clean Architecture se cumple por construcción.
plugins {
    alias(libs.plugins.kotlin.jvm)
    `java-test-fixtures`
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    api(libs.kotlinx.coroutines.core) // Flow forma parte de la API pública del dominio
    implementation(libs.javax.inject) // @Inject en los casos de uso (JSR-330, sin Android)

    testFixturesApi(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
