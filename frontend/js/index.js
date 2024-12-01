// Load the video file and render it into the video element
const video = document.getElementById('video')
const play = document.getElementById('video-play')
const controlersDiv = document.getElementById('controls')
const stopButton = document.getElementById('video-stop')
const rePlayButton = document.getElementById('video-re-play')

// video progress bar elements
const progressFill = document.getElementById('video-progress-fill')
const progressThumb = document.getElementById('video-progress-thumb')
const progressBar = document.getElementById('video-progress-bar')

// Hide the controls and replay button
controlersDiv.style.display = 'none'
rePlayButton.style.display = 'none'

// Load Video into the video element and play it using blob URL 
const videoURL = "http://localhost:8000/";
let start = 0;
const chunkSize = 5 * 1024 * 1024; // 5MB

const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

const haveMoreMediaSegments = () => {
    return start < 435 * 1024 * 1024; // 100MB
}

const getNextMediaSegment = async () => {
    const response = await fetch(videoURL, {
        headers: {
            Range: `bytes=${start}-${start + chunkSize - 1}`,
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    start += chunkSize;
    const buffer = await response.arrayBuffer();
    return buffer;
}

const appendNextMediaSegment = async (mediaSource) => {
    if (
        mediaSource.readyState === "closed" ||
        mediaSource.sourceBuffers[0].updating
    )
        return;

    // If we have run out of stream data, then signal end of stream.
    if (!haveMoreMediaSegments()) {
        mediaSource.endOfStream();
        video.play()
        return;
    }

    try {
        const mediaSegment = await getNextMediaSegment();

        // NOTE: If mediaSource.readyState == "ended", this appendBuffer() call will
        // cause mediaSource.readyState to transition to "open". The web application
        // should be prepared to handle multiple "sourceopen" events.
        mediaSource.sourceBuffers[0].appendBuffer(mediaSegment);
    }
    catch (error) {
        // Handle errors that might occur during media segment fetching.
        console.error("Error fetching media segment:", error);
        mediaSource.endOfStream("network");
    }
}

const getInitializationSegment = async () => {
    const response = await fetch(videoURL,{
        headers: {
            Range: `bytes=0-${chunkSize - 1}`,
        },
    });

    start = chunkSize;

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return buffer;
}

const onSeeking = async (mediaSource) => {
    if (mediaSource.readyState === "open") {
        // Abort current segment append.
        mediaSource.sourceBuffers[0].abort();
    }
    
    // Append a media segment from the new playback position.
    await appendNextMediaSegment(mediaSource);
}

mediaSource.addEventListener('sourceopen', async (e) => {
    const mediaSource = e.target;

    if (mediaSource.sourceBuffers.length > 0) return;

    const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');

    video.addEventListener("seeking", (e) => onSeeking(mediaSource));
    video.addEventListener("progress", async () =>
        await appendNextMediaSegment(mediaSource),
    );

    try {
        const initSegment = await getInitializationSegment();

        if (initSegment == null) {
            // Error fetching the initialization segment. Signal end of stream with an error.
            mediaSource.endOfStream("network");
            return;
        }

        // Append the initialization segment.
        sourceBuffer.addEventListener("updateend", async function firstAppendHandler() {
            sourceBuffer.removeEventListener("updateend", firstAppendHandler);

            // Append some initial media data.
            await appendNextMediaSegment(mediaSource);
        });

        sourceBuffer.appendBuffer(initSegment);
    } catch (error) {
        // Handle errors that might occur during initialization segment fetching.
        console.error("Error fetching initialization segment:", error);
        mediaSource.endOfStream("network");
    }
})


// Play video when play button is clicked
play.addEventListener('click', () => {
    if (mediaSource.readyState === 'open') {
        video.play()
    }
    controlersDiv.style.display = 'flex'
})

// hide play button when video is playing
video.addEventListener('play', () => {
    play.style.display = 'none'
})

// update the progress bar when video is playing
video.addEventListener('timeupdate', () => {
    // Get the current time and duration of the video
    const { currentTime, duration } = video

    // Calculate the progress value
    const progressValue = parseFloat((currentTime / duration) * 100).toFixed(2)

    // Update the progress bar
    progressFill.style.width = `calc(${progressValue}% + 2px)`
    progressThumb.style.left = `${progressValue}%`
})

// stop video when stop button is clicked
stopButton.addEventListener('click', () => {
    video.pause()
    play.style.display = 'block'
    controlersDiv.style.display = 'none'
})

//on video end show play button and hide controls
video.addEventListener('ended', () => {
    controlersDiv.style.display = 'none'
    rePlayButton.style.display = 'block'
})

// replay video when replay button is clicked
rePlayButton.addEventListener('click', () => {
    video.play()
    rePlayButton.style.display = 'none'
    controlersDiv.style.display = 'flex'
})

let isDragging = false;
let offsetX

progressThumb.addEventListener('mousedown', (e) => {
    isDragging = true;

    // Calculate the offset where the user clicked
    offsetX = e.clientX - progressThumb.offsetLeft;

    progressThumb.style.cursor = 'grabbing';
});

progressThumb.addEventListener('dragstart', (e) => {
    e.preventDefault();

    // stop progressThumb to go outside the progress bar
    progressThumb.style.top = '-4px';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate new position
    let newLeft = e.clientX - offsetX;

    // Restrict within bounds
    const outerRect = progressBar.getBoundingClientRect();
    const innerRect = progressThumb.getBoundingClientRect();

    if (newLeft < 0) newLeft = 0;
    if (newLeft + innerRect.width > outerRect.width) {
        newLeft = outerRect.width - innerRect.width;
    }

    // Apply new position
    progressThumb.style.left = `${newLeft}px`;
    progressFill.style.width = `${newLeft + 2}px`;
});

document.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        progressThumb.style.cursor = 'grab';

        // Calculate final position
        const outerRect = progressBar.getBoundingClientRect();
        let newLeft = e.clientX - offsetX;

        if (newLeft < 0) newLeft = 0;
        if (newLeft + progressThumb.offsetWidth > outerRect.width) {
            newLeft = outerRect.width - progressThumb.offsetWidth;
        }

        // Calculate progress and update video current time
        const progress = newLeft / outerRect.width;
        const newTime = progress * video.duration;

        if (!isNaN(newTime) && isFinite(newTime)) {
            video.currentTime = newTime;
        }
    }
});
