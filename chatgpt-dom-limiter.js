// ==UserScript==
// @name         ChatGPT DOM Limiter & Stable Lazy Reveal
// @namespace    https://chatgpt.com/*
// @version      2.5
// @description  Entfernt alte ChatGPT-Prompt+Antwort-Paare, cached sie und lädt sie bei Scroll wieder ein – stabil ohne Scrollsprung (overflow-anchor + scrollTop delta)
// @author       Der DOM-Schlächter
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 🧩 Konfiguration
  const MAX_PAIRS = 2;
  const htmlCache = [];
  const revealBatchSize = 2;

  let observer = null;

  function init() {
    const firstArticle = document.querySelector("main article");
    const container = firstArticle?.parentElement;
    const scrollElement = getScrollElement();

    if (!firstArticle || !container || !scrollElement) {
      console.log("[DOM_SHORTENER] Waiting for article elements...");
      return;
    }

    clearInterval(articleObserverWaiter);
    console.log("[DOM_SHORTENER] Found first article, initializing...");

    registerObserver(container);
    scrollElement.addEventListener('scroll', debounce(revealOlderMessages, 100));
  }

  function registerObserver(container) {
    const debounced = debounce(processMessages, 500);
    observer = new MutationObserver(debounced);
    observer.observe(container, { childList: true, subtree: false });
  }

  function processMessages() {
    const articles = Array.from(document.querySelectorAll('main article'));
    const container = articles[0]?.parentElement;
    if (!container) return;

    const excess = getExcessPairs(articles);

    for (let i = 0; i < excess; i++) {
      const prompt = articles[i * 2];
      const answer = articles[i * 2 + 1];
      if (!prompt || !answer) continue;

      removeAndCachePair(prompt, answer);
    }

    function getExcessPairs(articleList) {
      const pairCount = Math.floor(articleList.length / 2);
      return pairCount - MAX_PAIRS;
    }

    function removeAndCachePair(prompt, answer) {
      htmlCache.unshift({
        prompt: prompt.outerHTML,
        answer: answer.outerHTML
      });

      prompt.remove();
      answer.remove();

      console.log("[DOM_SHORTENER] Prompt+Answer pair removed and cached");
    }
  }

  function revealOlderMessages() {
    const scrollElement = getScrollElement();
    const scrollTop = scrollElement?.scrollTop || 0;
    const container = document.querySelector('main article')?.parentElement;

    if (!container || scrollTop > 200 || htmlCache.length === 0) return;

    pauseObserver();

    const firstVisible = container.firstElementChild;
    const offsetBefore = firstVisible?.getBoundingClientRect().top || 0;

    for (let i = 0; i < revealBatchSize && htmlCache.length > 0; i++) {
      const pair = htmlCache.shift();
      if (!pair?.prompt || !pair?.answer) continue;

      const promptNode = htmlToElement(pair.prompt);
      const answerNode = htmlToElement(pair.answer);

      // 🛡️ Gegen Scrollsprung: overflow-anchor deaktivieren
      promptNode.style.overflowAnchor = 'none';
      answerNode.style.overflowAnchor = 'none';

      promptNode.setAttribute('data-cached', 'true');
      answerNode.setAttribute('data-cached', 'true');

      container.insertBefore(answerNode, container.firstChild);
      container.insertBefore(promptNode, container.firstChild);

      console.log("[DOM_SHORTENER] Prompt+Answer pair reinserted");
    }

    const offsetAfter = firstVisible?.getBoundingClientRect().top || 0;
    scrollElement.scrollTop += offsetAfter - offsetBefore;

    resumeObserver(container);
  }

  function pauseObserver() {
    if (observer) observer.disconnect();
  }

  function resumeObserver(container) {
    if (observer) {
      observer.observe(container, { childList: true, subtree: false });
    }
  }

  function htmlToElement(html) {
    const range = document.createRange();
    const fragment = range.createContextualFragment(html);
    return fragment.firstElementChild;
  }

  function getScrollElement() {
    return document.querySelector("article")?.parentElement?.parentElement;
  }

  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  const articleObserverWaiter = setInterval(init, 1000);
})();
