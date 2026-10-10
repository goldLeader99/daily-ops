package com.dailyops.dashboard;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Small native boundary: no broad storage permission, background service, or device-owner role. */
@CapacitorPlugin(name = "DashboardDevice")
public class DashboardDevicePlugin extends Plugin {
    @Override
    public void load() {
        // Capacitor registers plugins before loading the bundled page. Only trusted local UI
        // may load here; external shortcuts use ACTION_VIEW and HTML frames are disabled.
        getBridge().getWebView().addJavascriptInterface(new DashboardStorage(getContext()), "DailyOpsStorage");
    }

    @PluginMethod
    public void fullscreen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).toggleFullscreen();
            call.resolve();
        });
    }

    @PluginMethod
    public void goHome(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Use Android's Home button to return to your launcher.", error);
        }
    }

    @PluginMethod
    public void systemSettings(PluginCall call) { openSettings(Settings.ACTION_SETTINGS, call); }

    private void openSettings(String action, PluginCall call) {
        try {
            getActivity().startActivity(new Intent(action));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Open Android Settings from the tablet's app list.", error);
        }
    }

    @PluginMethod
    public void openLink(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        if ((!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) ||
                uri.getHost() == null || uri.getUserInfo() != null) {
            call.reject("Use a valid HTTP or HTTPS address.");
            return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("No app is available to open this link.", error);
        }
    }

    @PluginMethod
    public void exportBackup(PluginCall call) {
        String content = call.getString("content");
        String filename = call.getString("filename", "daily-ops-backup.json");
        if (content == null || content.length() > 4000000 || !filename.matches("[a-zA-Z0-9.-]+\\.json")) {
            call.reject("Invalid backup or backup exceeds the 4 MB limit.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "backupDestination");
        } catch (ActivityNotFoundException error) {
            call.reject("No document picker is available on this device.", error);
        }
    }

    @ActivityCallback
    private void backupDestination(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri uri = result.getData().getData();
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) throw new java.io.IOException("Could not open destination");
            stream.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
            call.resolve(new JSObject().put("saved", true));
        } catch (Exception error) {
            call.reject("Could not export the backup. Choose a writable location and try again.", error);
        }
    }
}
