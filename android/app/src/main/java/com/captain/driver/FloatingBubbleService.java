package com.godelivo.captain;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.core.app.NotificationCompat;

public class FloatingBubbleService extends Service {

    private static final String CHANNEL_ID      = "floating_bubble_channel";
    private static final int    NOTIF_ID        = 1001;
    private static final int    BUBBLE_SIZE_DP  = 36;
    private static final int    EDGE_MARGIN_DP  = 3;
    private static final String PREFS_NAME      = "FloatingBubblePrefs";
    private static final String PREF_X          = "bubble_x";
    private static final String PREF_Y          = "bubble_y";

    private WindowManager               windowManager;
    private View                         bubbleView;
    private WindowManager.LayoutParams   params;
    private SharedPreferences            prefs;

    // Touch tracking
    private float   initialTouchX, initialTouchY;
    private int     initialX, initialY;
    private long    touchDownTime;
    private boolean isDragging;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        prefs         = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        addBubble();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (bubbleView != null && windowManager != null) {
            try {
                // Save position before destroying
                saveBubblePosition(params.x, params.y);
                windowManager.removeView(bubbleView);
            } catch (Exception ignored) {}
            bubbleView = null;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ─── Bubble View ──────────────────────────────────────────────────────────

    private void addBubble() {
        int size   = dpToPx(BUBBLE_SIZE_DP);
        int margin = dpToPx(EDGE_MARGIN_DP);

        DisplayMetrics dm = new DisplayMetrics();
        windowManager.getDefaultDisplay().getMetrics(dm);

        // Restore saved position (default: right side, 55% down)
        int defaultX = dm.widthPixels - size - margin;
        int defaultY = (int) (dm.heightPixels * 0.55f);
        int savedX   = prefs.getInt(PREF_X, defaultX);
        int savedY   = prefs.getInt(PREF_Y, defaultY);

        // Clamp to screen bounds
        savedX = Math.max(0, Math.min(savedX, dm.widthPixels - size));
        savedY = Math.max(0, Math.min(savedY, dm.heightPixels - size - dpToPx(80)));

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                size,
                size,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.TOP | Gravity.START;
        params.x       = savedX;
        params.y       = savedY;

        bubbleView = buildBubbleView(size);
        setupTouchListener(size, dm);

        windowManager.addView(bubbleView, params);
    }

    private View buildBubbleView(int size) {
        // Outer container (FrameLayout for layering)
        FrameLayout container = new FrameLayout(this);

        // Circular background
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(0xFFfccf1e); // GoDelivo brand yellow
        circle.setStroke(dpToPx(2), 0xFFFFFFFF);
        // Stroke removed to show logo more clearly

        // Outer shadow ring (slightly larger)
        GradientDrawable shadow = new GradientDrawable();
        shadow.setShape(GradientDrawable.OVAL);
        shadow.setColor(0x33000000);

        container.setBackground(circle);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            container.setElevation(dpToPx(10));
            container.setClipToOutline(true); // Forces a perfect circular crop based on the oval background
        }

        // App logo ImageView centered inside the bubble
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher); // Use default launcher to guarantee highest res
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);

        // Make logo fill the container exactly so its square edges get clipped by the container's circular outline
        int logoSize = size; 

        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(logoSize, logoSize);
        logoParams.gravity = Gravity.CENTER;
        container.addView(logo, logoParams);

        return container;
    }

    // ─── Touch / Drag ─────────────────────────────────────────────────────────

    private void setupTouchListener(int size, DisplayMetrics dm) {
        bubbleView.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    initialX      = params.x;
                    initialY      = params.y;
                    initialTouchX = event.getRawX();
                    initialTouchY = event.getRawY();
                    touchDownTime = System.currentTimeMillis();
                    isDragging    = false;
                    return true;

                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - initialTouchX;
                    float dy = event.getRawY() - initialTouchY;
                    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
                        isDragging = true;
                    }
                    if (isDragging) {
                        int newX = (int) (initialX + dx);
                        int newY = (int) (initialY + dy);
                        // Clamp within screen
                        newX = Math.max(0, Math.min(newX, dm.widthPixels - size));
                        newY = Math.max(0, Math.min(newY, dm.heightPixels - size - dpToPx(80)));
                        params.x = newX;
                        params.y = newY;
                        windowManager.updateViewLayout(bubbleView, params);
                    }
                    return true;

                case MotionEvent.ACTION_UP:
                    long elapsed = System.currentTimeMillis() - touchDownTime;
                    if (!isDragging && elapsed < 350) {
                        // Tap: open app
                        openApp();
                    } else if (isDragging) {
                        // Snap to side
                        DisplayMetrics dmLocal = new DisplayMetrics();
                        windowManager.getDefaultDisplay().getMetrics(dmLocal);
                        int midX = dmLocal.widthPixels / 2;
                        int margin = dpToPx(EDGE_MARGIN_DP);
                        int finalX = (params.x + (size / 2) > midX) ? (dmLocal.widthPixels - size - margin) : margin;
                        params.x = finalX;
                        windowManager.updateViewLayout(bubbleView, params);
                        
                        // Save final position
                        saveBubblePosition(params.x, params.y);
                    }
                    return true;
            }
            return false;
        });
    }

    private void saveBubblePosition(int x, int y) {
        prefs.edit()
                .putInt(PREF_X, x)
                .putInt(PREF_Y, y)
                .apply();
    }

    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
