plugins {
    id("com.android.application")
}

android {
    namespace = "com.lightflow.widgets"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.lightflow.widgets"
        minSdk = 26
        targetSdk = 36
        versionCode = 6
        versionName = "0.4.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.work:work-runtime:2.12.0")
}
