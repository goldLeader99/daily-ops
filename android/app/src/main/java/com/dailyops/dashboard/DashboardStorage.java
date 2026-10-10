package com.dailyops.dashboard;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

/** A fixed-key store for the bundled UI. Calls run on WebView's Java bridge thread. */
public final class DashboardStorage {
    private static final String KEY = "daily-ops:data:v1";
    private final SharedPreferences preferences;
    private String saved;

    public DashboardStorage(Context context) {
        preferences = context.getSharedPreferences("daily_ops_storage", Context.MODE_PRIVATE);
        saved = preferences.getString(KEY, null);
    }

    @JavascriptInterface
    public synchronized String read() {
        return saved;
    }

    @JavascriptInterface
    public synchronized boolean write(String value) {
        if (value == null || value.length() > 4000000) return false;
        // commit() confirms the disk write; apply() would acknowledge only an in-memory update.
        if (!preferences.edit().putString(KEY, value).commit()) return false;
        saved = value;
        return true;
    }
}
