plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// A throwaway signing key checked into the repo so every build (local or CI) is signed the same way.
// That is what lets a newer APK install over an older one without uninstalling first.
val sharedKeystore = rootProject.file("keystore/signal-watch.jks")

android {
    namespace = "ca.signalwatch"
    compileSdk = 34

    defaultConfig {
        applicationId = "ca.signalwatch"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        if (sharedKeystore.exists()) {
            create("shared") {
                storeFile = sharedKeystore
                storePassword = "signalwatch"
                keyAlias = "signalwatch"
                keyPassword = "signalwatch"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (sharedKeystore.exists()) signingConfig = signingConfigs.getByName("shared")
        }
        debug {
            if (sharedKeystore.exists()) signingConfig = signingConfigs.getByName("shared")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    sourceSets["main"].java.srcDirs("src/main/kotlin")
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
