import { describe, expect, it } from 'vitest';
import { deviceOf, isBot, isPagePath, normalisePath, referrerHostOf } from './rules.js';

/**
 * The rules that decide what is stored, tested without a database.
 *
 * These are the privacy guarantees in code form: a user agent becomes one of
 * three words, a referrer becomes a bare host or nothing, and a path that is
 * not a page of this site is dropped rather than counted.
 */

describe('isBot', () => {
  it('drops the crawlers that announce themselves', () => {
    for (const agent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
      'facebookexternalhit/1.1',
      'curl/8.4.0',
      'python-requests/2.31.0',
      'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120',
      'AhrefsBot/7.0',
    ]) {
      expect(isBot(agent), agent).toBe(true);
    }
  });

  it('treats a missing user agent as automation', () => {
    expect(isBot(undefined)).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('   ')).toBe(true);
  });

  it('keeps real browsers', () => {
    for (const agent of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/133.0',
    ]) {
      expect(isBot(agent), agent).toBe(false);
    }
  });
});

describe('deviceOf', () => {
  it('sorts a user agent into one of three words', () => {
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2) Mobile/15E148')).toBe('mobile');
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36')).toBe('mobile');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X)')).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-X200) Safari/537.36')).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131')).toBe('desktop');
    expect(deviceOf(undefined)).toBe('desktop');
  });
});

describe('referrerHostOf', () => {
  it('keeps the host and nothing else', () => {
    expect(referrerHostOf('https://www.google.com/search?q=secret+terms', null)).toBe('google.com');
    // A subdomain is a different site; only a leading www. is dropped.
    expect(referrerHostOf('https://news.example.org/a/b?token=abc#x', null)).toBe('news.example.org');
  });

  it('ignores our own pages, with or without www', () => {
    expect(referrerHostOf('https://teamenergo.rs/sr/usluge', 'teamenergo.rs')).toBeNull();
    expect(referrerHostOf('https://www.teamenergo.rs/sr', 'teamenergo.rs')).toBeNull();
    expect(referrerHostOf('https://teamenergo.rs/sr', 'www.teamenergo.rs')).toBeNull();
  });

  it('returns null rather than storing something it could not parse', () => {
    expect(referrerHostOf('not a url', null)).toBeNull();
    expect(referrerHostOf('', null)).toBeNull();
    expect(referrerHostOf(undefined, null)).toBeNull();
  });
});

describe('normalisePath', () => {
  it('drops the query and the hash', () => {
    expect(normalisePath('/sr/usluge?utm_source=x#top')).toBe('/sr/usluge');
  });

  it('removes a trailing slash but keeps the root', () => {
    expect(normalisePath('/sr/usluge/')).toBe('/sr/usluge');
    expect(normalisePath('/')).toBe('/');
  });

  it('refuses anything that is not a path', () => {
    expect(normalisePath('https://evil.example/x')).toBeNull();
    expect(normalisePath(`/${'a'.repeat(400)}`)).toBeNull();
  });
});

describe('isPagePath', () => {
  it('accepts the pages this site has', () => {
    for (const path of [
      '/sr',
      '/en',
      '/sr/usluge',
      '/sr/usluge/telekomunikacije',
      '/sr/vesti/zavrsena-deonica-12-km',
      '/sr/sertifikati/iso-9001',
      '/en/reference/referenca-1',
    ]) {
      expect(isPagePath(path), path).toBe(true);
    }
  });

  it('refuses what scanners probe for, so the top-pages list is pages', () => {
    for (const path of [
      '/wp-login.php',
      '/.env',
      '/admin',
      '/sr/../etc/passwd',
      '/SR/USLUGE',
      '/de/usluge',
      '/sr/usluge<script>',
    ]) {
      expect(isPagePath(path), path).toBe(false);
    }
  });
});
