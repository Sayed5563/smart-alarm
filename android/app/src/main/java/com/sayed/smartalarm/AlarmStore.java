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
 */
final class AlarmStore {

  private static final String PREFS = "smart_alarm_native";
  private static final String KEY = "scheduled";

  static class Entry {
    int id;
    long at;
    String title;
    String kind;      // "alarm" | "snooze" | "pre-alarm"
    String alarmId;   // the web-side alarm id
    String firedKey;

    JSONObject toJson() throws JSONException {
      JSONObject o = new JSONObject();
      o.put("id", id);
      o.put("at", at);
      o.put("title", title == null ? "" : title);
      o.put("kind", kind == null ? "alarm" : kind);
      o.put("alarmId", alarmId == null ? "" : alarmId);
      o.put("firedKey", firedKey == null ? "" : firedKey);
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
}
