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
const loadVideo = async () => {
    // read video file from videos folder and make it a blob and render that into video when blob is
    const response = await fetch('http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4')

    // Get the total length of the video file
    const contentLength = response.headers.get('Content-Length')
    const totalBytes = parseInt(contentLength, 10)
    let loadedBytes = 0

    // Read the video file in chunks and update the progress bar
    const reader = response.body.getReader()
    const chunks = []

    // Read the video file in chunks and update the progress bar
    while (true) {
        // Read the next chunk
        const { done, value } = await reader.read()

        // If there are no more chunks, break the loop
        if (done) break

        // Update the progress bar
        chunks.push(value)
        loadedBytes += value.length

        // Calculate the percentage of the video that has been loaded
        const percentLoaded = (loadedBytes / totalBytes) * 100
    }

    // Create a blob from the chunks and render it into the video element
    const blob = new Blob(chunks)
    video.src = URL.createObjectURL(blob)
}
loadVideo()

// Play video when play button is clicked
play.addEventListener('click', () => {
    video.play()
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
