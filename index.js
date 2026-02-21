const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dxzVideoQualities = ['144', '240', '360', '720', '1080'];
const dxzAudioQualities = ['96', '128', '256', '320'];

function dxzExtractId(url) { 
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function dxzMapAudioQuality(bitrate) {
  if (bitrate == 320) return 0;
  if (bitrate == 256) return 1;
  if (bitrate == 128) return 4;
  if (bitrate == 96)  return 5;
  return 4;
}

async function dxzRequest(url, data) {
  return axios.post(url, data, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
      'Content-Type': 'application/json',
      origin: 'https://cnvmp3.com',
      referer: 'https://cnvmp3.com/v51'
    }
  });
}

async function dxzDownload(yturl, quality, format = 'mp3') {
  const dxzYoutubeId = dxzExtractId(yturl);
  if (!dxzYoutubeId) throw new Error('Invalid YouTube URL');

  const dxzFormatValue = format === 'mp4' ? 0 : 1;
  let dxzFinalQuality;

  if (dxzFormatValue === 0) {
    if (!dxzVideoQualities.includes(String(quality))) {
      throw new Error('Invalid MP4 quality. Allowed: 144, 240, 360, 720, 1080');
    }
    dxzFinalQuality = parseInt(quality);
  } else {
    if (!dxzAudioQualities.includes(String(quality))) {
      throw new Error('Invalid MP3 quality. Allowed: 96, 128, 256, 320');
    }
    dxzFinalQuality = dxzMapAudioQuality(parseInt(quality));
  }

  const dxzCheck = await dxzRequest('https://cnvmp3.com/check_database.php', {
    youtube_id: dxzYoutubeId,
    quality: dxzFinalQuality,
    formatValue: dxzFormatValue
  });

  if (dxzCheck.data && dxzCheck.data.success && dxzCheck.data.data) {
    return {
      title: dxzCheck.data.data.title,
      download: dxzCheck.data.data.server_path
    };
  }

  const dxzFullUrl = `http://googleusercontent.com/youtube.com/${dxzYoutubeId}`;
  
  const dxzVideoData = await dxzRequest('https://cnvmp3.com/get_video_data.php', {
    url: dxzFullUrl,
    token: "1234"
  });

  if (dxzVideoData.data.error) throw new Error(dxzVideoData.data.error);

  const dxzTitle = dxzVideoData.data.title;

  const dxzDownloadResp = await dxzRequest('https://cnvmp3.com/download_video_ucep.php', {
    url: dxzFullUrl,
    quality: dxzFinalQuality,
    title: dxzTitle,
    formatValue: dxzFormatValue
  });

  if (dxzDownloadResp.data.error) throw new Error(dxzDownloadResp.data.error);

  const dxzFinalLink = dxzDownloadResp.data.download_link;

  await dxzRequest('https://cnvmp3.com/insert_to_database.php', {
    youtube_id: dxzYoutubeId,
    server_path: dxzFinalLink,
    quality: dxzFinalQuality,
    title: dxzTitle,
    formatValue: dxzFormatValue
  });

  return {
    title: dxzTitle,
    download: dxzFinalLink
  };
}

// API Endpoint
app.get('/api/download', async (req, res) => {
  const { url, quality, format } = req.query;

  // Check required parameters
  if (!url || !quality || !format) {
    return res.status(400).json({
      creator: "AK_CREATIONS",
      success: false,
      message: "Missing parameters. Please provide 'url', 'quality', and 'format'."
    });
  }

  try {
    const result = await dxzDownload(url, quality, format);
    
    // Success response with AK_CREATIONS
    res.json({
      creator: "AK_CREATIONS",
      success: true,
      title: result.title,
      download_link: result.download
    });

  } catch (error) {
    // Error response with AK_CREATIONS
    res.status(500).json({
      creator: "AK_CREATIONS",
      success: false,
      message: error.message
    });
  }
});

// Export the app for Vercel
module.exports = app;

// Local development server (Will not interfere with Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Example MP4: http://localhost:${PORT}/api/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&quality=720&format=mp4`);
  });
}

