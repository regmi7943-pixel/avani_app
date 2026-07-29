const { fetchGoogleYouTubeVideos } = require('./src/lib/youtubeService');

async function testFetch() {
  console.log("Diagnostic test starting...");
  try {
    const res = await fetchGoogleYouTubeVideos('all', '');
    console.log("Fetched items count:", res.items ? res.items.length : 0);
    if (res.items && res.items.length > 0) {
      console.log("Sample item duration:", res.items[0].duration);
      console.log("Sample item title:", res.items[0].titleEn);
    }
  } catch (e) {
    console.error("Diagnostic catch:", e);
  }
}

testFetch();
