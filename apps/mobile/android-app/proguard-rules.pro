# kotlinx.serialization: keep serializers
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keep,includedescriptorclasses class com.lifetracker.**$$serializer { *; }
-keepclassmembers class com.lifetracker.** {
    *** Companion;
}
-keepclasseswithmembers class com.lifetracker.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit + OkHttp (R3 rules included in artifacts; minimal extras)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**

# Tink (via androidx.security:EncryptedSharedPreferences) references
# errorprone annotations that are compile-only and absent at runtime
-dontwarn com.google.errorprone.annotations.**
