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
