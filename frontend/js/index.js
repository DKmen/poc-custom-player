// Select DOM elements
const video = document.getElementById('video');
const play = document.getElementById('video-play');
const controlsDiv = document.getElementById('controls');
const stopButton = document.getElementById('video-stop');
const rePlayButton = document.getElementById('video-re-play');

// Video progress bar elements
const progressFill = document.getElementById('video-progress-fill');
const progressThumb = document.getElementById('video-progress-thumb');
const progressBar = document.getElementById('video-progress-bar');

// Hide the controls and replay button initially
controlsDiv.style.display = 'none';
rePlayButton.style.display = 'none';

// Video URL and chunk settings
const videoURL = "http://localhost:8000/";
let start = 0;
const chunkSize = 5 * 1024 * 1024; // 5MB

// MediaSource setup
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

// Utility function to check if more media segments are available
const haveMoreMediaSegments = () => start < 10 * 1024 * 1024; // Example: 10MB

// Fetch the next media segment
const getNextMediaSegment = async () => {
    const response = await fetch(videoURL, {
        headers: { Range: `bytes=${start}-${start + chunkSize - 1}` },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    start += chunkSize;
    return await response.arrayBuffer();
};

// Append next media segment to SourceBuffer
const appendNextMediaSegment = async (mediaSource) => {
    if (mediaSource.readyState === "closed" || mediaSource.sourceBuffers[0].updating) return;

    if (!haveMoreMediaSegments()) {
        mediaSource.endOfStream();
        return;
    }

    try {
        const mediaSegment = await getNextMediaSegment();
        mediaSource.sourceBuffers[0].appendBuffer(mediaSegment);
    } catch (error) {
        console.error("Error fetching media segment:", error);
        mediaSource.endOfStream("network");
    }
};

// Fetch the initialization segment
const getInitializationSegment = async () => {
    const response = await fetch(videoURL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.arrayBuffer();
};

// Handle seeking in video
const onSeeking = async (mediaSource) => {
    if (mediaSource.readyState === "open") {
        mediaSource.sourceBuffers[0].abort();
        await appendNextMediaSegment(mediaSource);
    }
};

// MediaSource event handlers
mediaSource.addEventListener('sourceopen', async () => {
    const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');

    video.addEventListener("seeking", () => onSeeking(mediaSource));
    video.addEventListener("progress", () => appendNextMediaSegment(mediaSource));

    try {
        const initSegment = await getInitializationSegment();
        sourceBuffer.addEventListener("updateend", async function firstAppendHandler() {
            sourceBuffer.removeEventListener("updateend", firstAppendHandler);
            await appendNextMediaSegment(mediaSource);
        });

        sourceBuffer.appendBuffer(initSegment);
    } catch (error) {
        console.error("Error fetching initialization segment:", error);
        mediaSource.endOfStream("network");
    }
});

// Video control event handlers
play.addEventListener('click', () => {
    video.play();
    controlsDiv.style.display = 'flex';
});

video.addEventListener('play', () => play.style.display = 'none');
video.addEventListener('timeupdate', () => {
    const { currentTime, duration } = video;
    const progressValue = parseFloat((currentTime / duration) * 100).toFixed(2);

    progressFill.style.width = `calc(${progressValue}% + 2px)`;
    progressThumb.style.left = `${progressValue}%`;
});

stopButton.addEventListener('click', () => {
    video.pause();
    play.style.display = 'block';
    controlsDiv.style.display = 'none';
});

video.addEventListener('ended', () => {
    controlsDiv.style.display = 'none';
    rePlayButton.style.display = 'block';
});

rePlayButton.addEventListener('click', () => {
    video.play();
    rePlayButton.style.display = 'none';
    controlsDiv.style.display = 'flex';
});

// Progress bar dragging functionality
let isDragging = false;
let offsetX;

progressThumb.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - progressThumb.offsetLeft;
    progressThumb.style.cursor = 'grabbing';
});

progressThumb.addEventListener('dragstart', (e) => e.preventDefault());

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const outerRect = progressBar.getBoundingClientRect();
    const newLeft = Math.min(Math.max(0, e.clientX - offsetX), outerRect.width - progressThumb.offsetWidth);

    progressThumb.style.left = `${newLeft}px`;
    progressFill.style.width = `${newLeft + 2}px`;
});

document.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        progressThumb.style.cursor = 'grab';

        const outerRect = progressBar.getBoundingClientRect();
        const newLeft = Math.min(Math.max(0, e.clientX - offsetX), outerRect.width - progressThumb.offsetWidth);
        const progress = newLeft / outerRect.width;
        video.currentTime = progress * video.duration;
    }
});
