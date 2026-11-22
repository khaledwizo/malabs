// غلاف آيفون للعبة «جبهة الرافدين»: صفحة اللعبة (www/index.html) داخل WKWebView بملء الشاشة
// يُبنى بلا Xcode project عبر swiftc في GitHub Actions (ios/build_ipa.sh)
import UIKit
import WebKit
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // الصوت يشتغل حتى لو مفتاح الصامت مفعّل، ويختلط مع موسيقى الجهاز
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        return true
    }
}

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = .black
        w.rootViewController = GameVC()
        w.makeKeyAndVisible()
        window = w
    }
    func sceneDidBecomeActive(_ scene: UIScene) {
        try? AVAudioSession.sharedInstance().setActive(true)
        (window?.rootViewController as? GameVC)?.resumeAudio()
    }
}

// يمنع الاحتفاظ الدائري بين WKUserContentController والمتحكّم
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}

class GameVC: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    var web: WKWebView!

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let uc = WKUserContentController()
        // ملفات الأصوات بصيغة m4a على آيفون، وجسر بسيط بنفس أسماء جسر أندرويد (نسخ/مشاركة/اهتزاز)
        let js = """
        window.RAFIDAIN_IOS = true; window.RAFIDAIN_VOICE_EXT = 'm4a';
        (function(){ var post = function(k, v){ try { webkit.messageHandlers.rafidain.postMessage({ k: k, v: String(v) }); } catch (e) {} };
          window.RafidainAndroid = { copy: function(t){ post('copy', t); }, share: function(t){ post('share', t); }, vibrate: function(ms){ post('vibrate', ms); } }; })();
        """
        uc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.add(WeakHandler(self), name: "rafidain")
        cfg.userContentController = uc

        web = WKWebView(frame: .zero, configuration: cfg)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        web.uiDelegate = self
        web.navigationDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        load()
    }

    func load() {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") else { return }
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func resumeAudio() {
        web?.evaluateJavaScript("try{var A=window.__R&&window.__R.Audio;if(A&&A.ctx&&A.ctx.state!=='running')A.ctx.resume();}catch(e){}", completionHandler: nil)
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any], let k = d["k"] as? String else { return }
        let v = d["v"] as? String ?? ""
        switch k {
        case "copy":
            UIPasteboard.general.string = v
        case "share":
            let a = UIActivityViewController(activityItems: [v], applicationActivities: nil)
            a.popoverPresentationController?.sourceView = view
            a.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(a, animated: true)
        case "vibrate":
            let ms = Int(v) ?? 20
            let g = UIImpactFeedbackGenerator(style: ms > 60 ? .heavy : (ms > 25 ? .medium : .light))
            g.impactOccurred()
        default: break
        }
    }

    // نوافذ alert/confirm من الصفحة
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "تمام", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "لا", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "نعم", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
    // روابط خارجية تفتح بسفاري
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = navigationAction.request.url { UIApplication.shared.open(u) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = navigationAction.request.url, let s = u.scheme, s == "http" || s == "https", navigationAction.targetFrame?.isMainFrame ?? true, navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(u); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    // إذا أغلق النظام عملية الصفحة (ضغط ذاكرة) نعيد التحميل بدل شاشة سوداء
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { load() }
}
