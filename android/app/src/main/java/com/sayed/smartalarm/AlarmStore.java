package com.sayed.smartalarm;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Tiny SharedPreferences record of what's been scheduled with AlarmManager, so
 * we can re-arm every future alarm after a reboot (no JS runs on boot).
 *
 * Also holds a queue of Stop/Snooze actions the user took while the web layer
 * wasn't running. Those used to be delivered by launching MainActivity, which
 * is what made the app flash open after Stop; now they simply wait here until
 * the app is next opened for its own reasons.
 */
final class AlarmStore {

  private static final String PREFS = "smart_alarm_native";
  private static final String KEY = "scheduled";
  private static final String KEY_PENDING = "pendingActions";
  /** Don't let an app that's never opened grow this without bound. */
  private static final int MAX_PENDING = 50;

  static class Entry {
    int id;
    long at;
    String title;
    String kind;          // "alarm" | "snooze" | "pre-alarm"
    String alarmId;       // the web-side alarm id
    String firedKey;
    /** Lets the service re-arm a snooze on its own, without waking the web layer. */
    int snoozeMinutes;
    /** Only on queued actions: "stop" | "snooze". */
    String action;

    JSONObject toJson() throws JSONException {
      JSONObject o = new JSONObject();
      o.put("id", id);
      o.put("at", at);
      o.put("title", title == null ? "" : title);
      o.put("kind", kind == null ? "alarm" : kind);
      o.put("alarmId", alarmId == null ? "" : alarmId);
      o.put("firedKey", firedKey == null ? "" : firedKey);
      o.put("snoozeMinutes", snoozeMinutes);
      if (action != null) o.put("action", action);
      return o;
    }

    static Entry fromJson(JSONObject o) {
      Entry e = new Entry();
      e.id = o.optInt("id");
      e.at = o.optLong("at");
      e.title = o.optString("title");
      e.kind = o.optString("kind", "alarm");
      e.alarmId = o.optString("alarmId");
      e.firedKey = o.optString("firedKey");
      e.snoozeMinutes = o.optInt("snoozeMinutes");
      e.action = o.has("action") ? o.optString("action") : null;
      return e;
    }
  }

  private static SharedPreferences prefs(Context ctx) {
    return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  static synchronized List<Entry> all(Context ctx) {
    List<Entry> out = new ArrayList<>();
    String raw = prefs(ctx).getString(KEY, "[]");
    try {
      JSONArray arr = new JSONArray(raw);
      for (int i = 0; i < arr.length(); i++) out.add(Entry.fromJson(arr.getJSONObject(i)));
    } catch (JSONException ignored) {}
    return out;
  }

  private static synchronized void save(Context ctx, List<Entry> entries) {
    JSONArray arr = new JSONArray();
    for (Entry e : entries) {
      try { arr.put(e.toJson()); } catch (JSONException ignored) {}
    }
    prefs(ctx).edit().putString(KEY, arr.toString()).apply();
  }

  static synchronized void put(Context ctx, Entry entry) {
    List<Entry> entries = all(ctx);
    entries.removeIf(e -> e.id == entry.id);
    entries.add(entry);
    save(ctx, entries);
  }

  static synchronized void remove(Context ctx, int id) {
    List<Entry> entries = all(ctx);
    entries.removeIf(e -> e.id == id);
    save(ctx, entries);
  }

  static synchronized void clear(Context ctx) {
    save(ctx, new ArrayList<>());
  }

  static synchronized Entry get(Context ctx, int id) {
    for (Entry e : all(ctx)) if (e.id == id) return e;
    return null;
  }

  // ------------------------------------------------- queued Stop/Snooze actions

  /** Record a Stop/Snooze the user made outside the app, for JS to pick up later. */
  static synchronized void addPending(Context ctx, Entry entry) {
    List<Entry> q = pending(ctx);
    q.add(entry);
    while (q.size() > MAX_PENDING) q.remove(0);
    savePending(ctx, q);
  }

  static synchronized List<Entry> pending(Context ctx) {
    List<Entry> out = new ArrayList<>();
    String raw = prefs(ctx).getString(KEY_PENDING, "[]");
    try {
      JSONArray arr = new JSONArray(raw);
      for (int i = 0; i < arr.length(); i++) out.add(Entry.fromJson(arr.getJSONObject(i)));
    } catch (JSONException ignored) {}
    return out;
  }

  /** Hand the queue to the caller and empty it in one step. */
  static synchronized List<Entry> takePending(Context ctx) {
    List<Entry> q = pending(ctx);
    if (!q.isEmpty()) savePending(ctx, new ArrayList<>());
    return q;
  }

  private static synchronized void savePending(Context ctx, List<Entry> entries) {
    JSONArray arr = new JSONArray();
    for (Entry e : entries) {
      try { arr.put(e.toJson()); } catch (JSONException ignored) {}
    }
    prefs(ctx).edit().putString(KEY_PENDING, arr.toString()).apply();
  }
}
