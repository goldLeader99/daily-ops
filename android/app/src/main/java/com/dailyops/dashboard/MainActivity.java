package com.dailyops.dashboard;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean fullscreen = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DashboardDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }

    public void toggleFullscreen() {
        fullscreen = !fullscreen;
        updateSystemBars();
    }

    private void updateSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), !fullscreen);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(fullscreen
            ? WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            : WindowInsetsControllerCompat.BEHAVIOR_DEFAULT);
        if (fullscreen) controller.hide(WindowInsetsCompat.Type.systemBars());
        else controller.show(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Reopening behaves like a regular app: Home and Recents are immediately available.
        fullscreen = false;
        updateSystemBars();
    }

    @Override
    public void onPause() {
        // Release our awake request when Home, Recents, or another Activity takes over.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
}
