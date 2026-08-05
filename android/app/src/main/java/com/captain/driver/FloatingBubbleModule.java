package com.godelivo.captain;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class FloatingBubbleModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "FloatingBubble";

    FloatingBubbleModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    // ─── Check permission ────────────────────────────────────────────────────

    @ReactMethod
    public void checkPermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("CHECK_PERMISSION_ERROR", e.getMessage());
        }
    }

    // ─── Request permission (opens Settings) ─────────────────────────────────

    @ReactMethod
    public void requestPermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && !Settings.canDrawOverlays(getReactApplicationContext())) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getReactApplicationContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
                promise.resolve(false); // permission not yet granted, user sent to settings
            } else {
                promise.resolve(true); // already granted
            }
        } catch (Exception e) {
            promise.reject("REQUEST_PERMISSION_ERROR", e.getMessage());
        }
    }

    // ─── Start bubble service ─────────────────────────────────────────────────

    @ReactMethod
    public void startBubble(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && !Settings.canDrawOverlays(ctx)) {
                promise.reject("NO_PERMISSION", "SYSTEM_ALERT_WINDOW permission not granted");
                return;
            }
            Intent service = new Intent(ctx, FloatingBubbleService.class);
            ctx.startService(service);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("START_ERROR", e.getMessage());
        }
    }

    // ─── Stop bubble service ──────────────────────────────────────────────────

    @ReactMethod
    public void stopBubble(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent service = new Intent(ctx, FloatingBubbleService.class);
            ctx.stopService(service);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_ERROR", e.getMessage());
        }
    }
}
