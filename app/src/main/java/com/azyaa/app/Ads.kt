package com.azyaa.app

import android.app.Activity
import android.os.CountDownTimer
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import com.google.android.gms.ads.*
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback

/** إعلانات AdMob: بيني مقابل مكافأة (زر بحث) + فيديو مقابل مكافأة (زر تحديث) */
class Ads(private val act: Activity) {

    companion object {
        const val REWARDED_INTERSTITIAL_ID = "ca-app-pub-5772143835741279/3762076526"
        const val REWARDED_VIDEO_ID = "ca-app-pub-5772143835741279/8958562882"
    }

    private var rewarded: RewardedAd? = null
    private var rewardedInter: RewardedInterstitialAd? = null

    fun init() {
        MobileAds.initialize(act) {}
        loadRewarded()
        loadRewardedInter()
    }

    /** يبين سبب فشل تحميل الإعلان (للتشخيص) */
    private fun report(which: String, e: LoadAdError) {
        val why = when (e.code) {
            AdRequest.ERROR_CODE_NO_FILL -> "ماكو إعلانات متوفرة حالياً (No fill)"
            AdRequest.ERROR_CODE_NETWORK_ERROR -> "مشكلة إنترنت"
            AdRequest.ERROR_CODE_INVALID_REQUEST -> "رقم الوحدة أو الإعدادات غلط"
            AdRequest.ERROR_CODE_APP_ID_MISSING -> "App ID ناقص"
            else -> "خطأ داخلي"
        }
        Toast.makeText(act, "$which ما تحمّل: كود ${e.code} - $why", Toast.LENGTH_LONG).show()
    }

    private fun loadRewarded() {
        RewardedAd.load(act, REWARDED_VIDEO_ID, AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { rewarded = ad }
                override fun onAdFailedToLoad(e: LoadAdError) { rewarded = null; report("فيديو التحديث", e) }
            })
    }

    private fun loadRewardedInter() {
        RewardedInterstitialAd.load(act, REWARDED_INTERSTITIAL_ID, AdRequest.Builder().build(),
            object : RewardedInterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedInterstitialAd) { rewardedInter = ad }
                override fun onAdFailedToLoad(e: LoadAdError) { rewardedInter = null; report("إعلان البحث", e) }
            })
    }

    /** زر التحديث: فيديو مقابل مكافأة، والمكافأة = صورة جديدة */
    fun showRewardedVideo(onReward: () -> Unit, onNotWatched: () -> Unit) {
        val ad = rewarded
        if (ad == null) { onReward(); loadRewarded(); return }   // ما في إعلان جاهز: لا نوقف المستخدم
        var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                rewarded = null; loadRewarded()
                if (earned) onReward() else onNotWatched()
            }
            override fun onAdFailedToShowFullScreenContent(e: AdError) {
                rewarded = null; loadRewarded(); onReward()
            }
        }
        ad.show(act) { earned = true }
    }

    /** زر البحث: إعلان بيني مقابل مكافأة مع شاشة تمهيد وزر تخطي (مطلوبة بسياسة AdMob) */
    fun showRewardedInterstitial(onDone: () -> Unit) {
        val ad = rewardedInter
        if (ad == null) { onDone(); loadRewardedInter(); return }

        val dialog = AlertDialog.Builder(act)
            .setTitle("إعلان قصير")
            .setMessage("سيبدأ إعلان بعد 5 ثوانٍ مقابل نتائج البحث")
            .setCancelable(false)
            .create()
        val timer = object : CountDownTimer(5000, 1000) {
            override fun onTick(ms: Long) {
                dialog.setMessage("سيبدأ إعلان بعد ${ms / 1000 + 1} ثوانٍ مقابل نتائج البحث")
            }
            override fun onFinish() {
                dialog.dismiss()
                ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        rewardedInter = null; loadRewardedInter(); onDone()
                    }
                    override fun onAdFailedToShowFullScreenContent(e: AdError) {
                        rewardedInter = null; loadRewardedInter(); onDone()
                    }
                }
                ad.show(act) { }
            }
        }
        dialog.setButton(AlertDialog.BUTTON_NEGATIVE, "تخطي") { _, _ ->
            timer.cancel(); onDone()
        }
        dialog.show()
        timer.start()
    }
}
