package app.whalechat.companion;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.whalechat.companion.dsexport.DeepSeekImportPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeepSeekImportPlugin.class);
        super.onCreate(savedInstanceState);
        // 系统「字体大小」调得很大时，网页文字会整体放大把按钮挤出屏幕；这里限制最大放大到 115%
        try {
            android.webkit.WebSettings ws = getBridge().getWebView().getSettings();
            int zoom = Math.round(getResources().getConfiguration().fontScale * 100);
            ws.setTextZoom(Math.max(85, Math.min(zoom, 115)));
        } catch (Exception ignored) {}
    }
}
