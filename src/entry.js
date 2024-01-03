let isActive = true
let previousScrollPosition = -1

window.onfocus = function () {
  console.log('on focus')
  isActive = true
}

window.onblur = function () {
  console.log('on blur')
  isActive = false
}

const STOP_SCROLLING_OVERLAY_TEMPLATE = '<div id="ss-newsfeed-overlay"><div class="ss-dialog"></div></div>'
const OVERLAY_DEFAULT_STYLE = {
  position: 'absolute',
  height: '100%',
  'z-index': '100',
  'background-color': 'white',
  opacity: '0.98'
}
const SS_DIALOG_CONTENT = `
    <h1>You've been scrolling Facebook for <span id="scroll-time-count"></span> minutes today!</p>
    <h1>You REALLY want to scroll Facebook newsfeed all day???</h1>
    <a href="#" class="ss-open-nf" data-amount="15"><p>Nooooo! Just 15 secs :)</p></a>
    <a href="#" class="ss-open-nf" data-amount="60"><p>Nah! Just 1 min :D</p></a>
    <a href="#" class="ss-open-nf" data-amount="300"><p>Just 5 mins :(</p></a>
    <hr/>
    <div id="use-with-caution" style="display: none">
      <p><strong>USE WITH CAUTION</strong></p>
      <a href="#" class="ss-open-nf" data-amount="600"><p>I NEED 10 MINUTES !</p></a>
      <a href="#" class="ss-open-nf" data-amount="1800"><p>I WANT MORE. GIVE ME 30 MINUTES !!!</p></a>
      <a href="#" class="ss-open-nf-custom"><p>GIVE ME X MINUTES (CUSTOM)</p></a>
      <hr/>
    </div>
    <p><strong>Settings</strong></p>
    <div><label><input type="checkbox" id="wait-for-video"><span>Wait for playing video to pause/stop before closing newsfeed</span></label></div>
    <div><label><input type="checkbox" id="return-to-previous-position"><span>Auto scroll to the position before closing newsfeed</span></label></div>
    <div><label><input type="checkbox" id="enable-use-with-caution"><span class="enable-longer-time-options">Enable longer time and customizable options</span></label></div>
    <hr/>
    <p><strong>Coming Features</strong></p>
    <ul>
      <li> - Wait if users are posting comments</li>
    </ul>
    <a href="https://chrome.google.com/webstore/detail/stop-scrolling-newsfeed-f/nhcbjhbdnlkddnapaoidpkfbjkpkpdcj/support" target="_blank">
      <p>Want new feature? Click here!</p>
    </a>
    <hr/>
    <strong>Helpful links</strong>
    <a href="https://chrome.google.com/webstore/detail/stop-scrolling-newsfeed-f/nhcbjhbdnlkddnapaoidpkfbjkpkpdcj/reviews" target="_blank">
      <p>Rate this application ★★★★★</p>
    </a>
    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=TDLNJGZJ24FBA&item_name=Buy+developer+of+Stop+Scrolling+Facebook+a+coffee&currency_code=USD&source=url" target="_blank">
      <p>Like this extension? Buy me a coffee!</p>
    </a>
    <a href="https://chrome.google.com/webstore/detail/stop-scrolling-newsfeed-f/nhcbjhbdnlkddnapaoidpkfbjkpkpdcj/support" target="_blank">
      <p>Ask for support or tell us your suggestion to make this application better</p>
    </a>
    <a href="https://github.com/tobernguyen/stop-scrolling-facebook" target="_blank">
      <p>Contribute to this open-source project or star it if you like!</p>
    </a>
    <a href="https://github.com/tobernguyen/stop-scrolling-facebook/blob/master/CHANGELOG.md" target="_blank">
      <p>Change log</p>
    </a>
  `
const NEWSFEED_STREAM_MATCHER = /^topnews_main_stream/
let settings = {
  waitForVideo: true,
  returnToPreviousPosition: true,
  currentCountDate: getTodayTimeString(),
  timeCountToday: 0,
  customTime: 0,
  enableUseWithCation: false
}

function getTodayTimeString () {
  const currentDate = new Date()
  return `${currentDate.getDate()}-${currentDate.getMonth()}-${currentDate.getFullYear()}`
}

const SETTINGS_TEMPLATE = {
  waitForVideo: true,
  returnToPreviousPosition: true,
  currentCountDate: '1-1-1970',
  timeCountToday: 0,
  customTime: 0,
  enableUseWithCation: false
}

// GET config from storage
chrome.storage.sync.get(SETTINGS_TEMPLATE, (items) => {
  console.log('get data done', items)
  settings = items

  // If the day has passed since last time opened Facebook
  // reset the timer and set currentCountDate to today
  if (items.currentCountDate !== getTodayTimeString()) {
    console.log('SSF', 'Reset timer')
    settings.timeCountToday = 0
    chrome.storage.sync.set({
      timeCountToday: 0,
      currentCountDate: getTodayTimeString()
    })
  }
})

// What to do receive new storage value
chrome.storage.onChanged.addListener((items) => {
  console.log('storage changed', items)
  Object.keys(items).forEach((k) => {
    if (items[k].newValue !== undefined) settings[k] = items[k].newValue
  })
  console.log('new settings', settings)
})

main()

let newsfeedContainer
async function main () {
  async function onNewsfeedPageFound () {
    // If it is newsfeed from group, ignore it as we want to block homepage's newsfeed only
    if (isUserOnGroupOrEvent()) {
      console.log('User is on group, ignore the newsfeed. Do nothing.')
    } else {
      injectSSF()
      scrollToTop()
      insertSSFOverlay()
      showStopScrollingDialog()
    }
  }
  console.log('Start watching for newsfeed page')
  // Quickly find the newsfeed container right after users open new Facebook tab
  await watchForNewsfeedPage(50, onNewsfeedPageFound, true)
  await watchForNewsfeedPage(1000, onNewsfeedPageFound)
}

async function watchForNewsfeedPage (interval, cb, findOnce = false) {
  // eslint-disable-next-line
  while (true) {
    console.log('looking for newsfeed page')

    if (!(isNewsfeedPageElementFound())) {
      newsfeedContainer = findNewsfeedContainer()
      // Check if newsfeed container is valid
      if (newsfeedContainer !== undefined && newsfeedContainer !== null && newsfeedContainer.getAttribute('ssf-injected') !== 'true') {
        console.log('Newsfeed found')

        await cb()

        // If findOnce is true, stop the loop
        if (findOnce) {
          break
        }
      } else {
        console.log('Newsfeed not found')
      }
    } else {
      console.log('newsfeed page is injected, no need to do it again')
    }
    await new Promise((accept) => setTimeout(accept, interval))
  }
}

function findNewsfeedContainer () {
  // let newsfeedContainer = findNewsfeedV1()
  // if (!newsfeedContainer) {
  //   newsfeedContainer = findNewsfeedV2()
  // } else {
  newsfeedContainer = findNewsfeedV3()
  // }
  return newsfeedContainer
}

// function findNewsfeedV1 () {
//   const streamContainer = document.getElementById('stream_pagelet')
//   let newsFeedElement = null

//   streamContainer.children.forEach((child) => {
//       if (NEWSFEED_STREAM_MATCHER.test(child.id)) {
//         newsFeedElement = child
//       }
//     })

//   return newsFeedElement
// }

// function findNewsfeedV2 () {
//   const $element = $('[role=feed]')
//   return $element.length > 0 ? $element : null
// }

function findNewsfeedV3 () {
  const element = document.querySelector('[role=main]')
  return element
}

function injectSSF () {
  newsfeedContainer.setAttribute('ssf-injected', 'true')
  console.log('SSF Injected')
}

function isUserOnGroupOrEvent () {
  const { pathname } = window.location
  return pathname.startsWith('/groups/') || pathname.startsWith('/events/')
}

function isNewsfeedPageOnScreen () {
  if (isUserOnGroupOrEvent()) {
    return false
  }
  const container = findNewsfeedContainer()
  return (container !== undefined && container !== null && container.getAttribute('ssf-injected') === 'true' && container.is(':visible'))
}

function isNewsfeedPageElementFound () {
  const container = findNewsfeedContainer()
  return (container !== undefined && container !== null && container.getAttribute('ssf-injected') === 'true')
}

function insertSSFOverlay () {
  let overlay = document.createElement('div')
  overlay.id = 'ss-newsfeed-overlay'
  overlay.innerHTML = "<div class='ss-dialog'></div>"
  overlay.style = Object.assign(overlay.style, calculateOverlayCss())
  newsfeedContainer.innerHTML = overlay.innerHTML

  // Prevent the SSF Overlay from being deleted by Facebook hydrate process
  let mutationsObserved = 0
  const observer = new MutationObserver(((mutations) => {
    mutationsObserved += mutations.length

    mutations.forEach((mutation) => {
      const { removedNodes } = mutation // DOM NodeList
      for (const node of removedNodes) {
        if (node.id === 'ss-newsfeed-overlay') {
          newsfeedContainer.prepend(overlay)
          break
        }
      }
    })

    // Disable observer after 3 mutations watched (confirm that the hydrate process is complete)
    if (mutationsObserved >= 3) {
      console.log('observer disconnected')
      observer.disconnect()
    }
  }))

  observer.observe(newsfeedContainer, {
    attributes: true,
    childList: true,
    characterData: true
  })
}

let timerInterval

function startTimer () {
  timerInterval = setInterval(countAndUpdateScrollingTime, 12000)
}

function stopTimer () {
  if (timerInterval) clearInterval(timerInterval)
}

function countAndUpdateScrollingTime () {
  const syncData = {}

  // Don't count if current window is not active
  if (!isActive) return

  if (settings.currentCountDate === getTodayTimeString()) {
    if (typeof settings.timeCountToday === 'number') {
      syncData.timeCountToday = settings.timeCountToday + 12
    } else {
      syncData.timeCountToday = 12
    }
  } else {
    syncData.currentCountDate = getTodayTimeString()
    syncData.timeCountToday = 0
  }

  chrome.storage.sync.set(syncData)
}

function scrollToTop () {
  document.querySelector('html, body').animate({ scrollTop: 0 }, { duration: 100})
}

function calculateOverlayCss () {
  return { width: newsfeedContainer.offsetWidth, ...OVERLAY_DEFAULT_STYLE }
}

function updateTimerText () {
  newsfeedContainer.querySelector('#ss-newsfeed-overlay span#scroll-time-count').innerText = Math.round(settings.timeCountToday / 60)
}

function showStopScrollingDialog () {
  const stopScrollingOverlay = document.getElementById('ss-newsfeed-overlay')
  const stopScrollingDialog = stopScrollingOverlay.querySelector('.ss-dialog')

  stopScrollingDialog.innerHTML = SS_DIALOG_CONTENT
  stopScrollingDialog.querySelector('.ss-open-nf-custom').click(() => {
    const minutes = Number(window.prompt('How many minutes do you want?', settings.customTime || ''))
    if (minutes <= 0) {
      window.alert('Invalid. Must be greater than 0 minutes.')
    } else {
      openNewsFeed(minutes * 60)
      settings.customTime = minutes
      chrome.storage.sync.set({
        customTime: minutes
      })
    }
  })
  stopScrollingDialog.querySelector('.ss-open-nf').each(function () {
    this.addEventListener('click', () => {
      const secToOpen = parseInt(this.dataset.amount)
      openNewsFeed(secToOpen)
    })
  })

  updateTimerText()

  // Wait for video section
  const inputWaitForVideo = stopScrollingDialog.getElementById('wait-for-video')
  inputWaitForVideo.setAttribute('checked', settings.waitForVideo)
  inputWaitForVideo.addEventListener('change', () => {
    settings.waitForVideo = inputWaitForVideo.checked
    chrome.storage.sync.set({
      waitForVideo: inputWaitForVideo.checked
    })
  })

  // Return to previous position
  const inputReturnToPreviousPosition = stopScrollingDialog.getElementById('return-to-previous-position')
  inputReturnToPreviousPosition.setAttribute('checked', settings.returnToPreviousPosition)
  inputReturnToPreviousPosition.addEventListener('change', () => {
    settings.returnToPreviousPosition = inputReturnToPreviousPosition.checked
    chrome.storage.sync.set({
      returnToPreviousPosition: inputReturnToPreviousPosition.checked
    })
  })

  // Longer time option (aka Use with caution)
  const inputShowLongerTimeOptions = stopScrollingDialog.getElementById('enable-use-with-caution')
  inputShowLongerTimeOptions.setAttribute('checked', settings.enableUseWithCation)
  inputShowLongerTimeOptions.addEventListener('change', () => {
    if (settings.enableUseWithCation) {
      alert('You made a right choice, and also a brave choice ;) But it will be definitely worth it!')
      chrome.storage.sync.set({
        enableUseWithCation: false
      }, () => window.location.reload())
    } else {
      const confirm = window.confirm('!!!CAUTION!!!\n\nThis is a VERY VERY VERY DANGEROUS option. You will definitely SPEND MORE TIME on Facebook. Are you sure to do this?')
      if (confirm) {
        chrome.storage.sync.set({
          enableUseWithCation: true
        }, () => window.location.reload())
      } else {
        inputShowLongerTimeOptions.setAttribute('checked', settings.enableUseWithCation)
      }
    }
  })
  if (settings.enableUseWithCation) stopScrollingDialog.getElementById('use-with-caution').show()
}

function openNewsFeed (secToOpen) {
  startTimer()
  document.getElementById('ss-newsfeed-overlay').style.display = 'none'

  // Scroll to previous position
  if (settings.returnToPreviousPosition) {
    document.querySelector('html, body').animate({ scrollTop: previousScrollPosition }, { duration: 100})
  }

  console.log(`Open for ${secToOpen} secs`)

  // Set timer to hide news feed again
  setTimeout(reCloseNewsfeed, secToOpen * 1000)

  // Set timer for reminder
  setTimeout(notifyOutOfTime, (secToOpen - 10) * 1000)
}

async function reCloseNewsfeed () {
  // Check if user still on News Feed page, otherwise do nothing
  if (isNewsfeedPageElementFound()) {
    const closeNewsFeed = function () {
      document.getElementById('ss-newsfeed-overlay').style.display = 'block'
      updateTimerText()
      stopTimer()

      if (isNewsfeedPageOnScreen()) {
        storeCurrentScrollPosition()
        scrollToTop()
      }
    }

    // Check if there are a video playing
    // if yes, wait until it pause/ended
    // otherwise close newsfeed immediately
    const playingVideoElem = getPlayingVideoElem()
    if (settings.waitForVideo && playingVideoElem) {
      playingVideoElem.onpause = () => {
        closeNewsFeed()
        playingVideoElem.onpause = null
        playingVideoElem.pause()
      }
    } else {
      closeNewsFeed()
    }
  }
}

function getPlayingVideoElem () {
  let playingVideoElem
  document.querySelectorAll('video').each(function () {
    if (!this.paused) playingVideoElem = this
  })
  return playingVideoElem
}

async function notifyOutOfTime () {
  if (await isNewsfeedPageOnScreen()) {
    const notyTimeOutInSecs = 10
    let notyText
    let showProgressBar = true
    // Check if there are a video playing
    // if yes, wait until it pause/ended
    // otherwise close newsfeed immediately
    const playingVideoElem = getPlayingVideoElem()
    if (settings.waitForVideo && playingVideoElem) {
      const videoRemainingSeconds = parseInt(playingVideoElem.duration - playingVideoElem.currentTime, 10)
      notyText = `<strong>Video playing detected</strong><br/>Newsfeed will be close when video is paused or after it is ended - ${videoRemainingSeconds} seconds remaining (click to dismiss)`
      showProgressBar = false
    } else {
      notyText = `<strong>The Newsfeed will be closed in ${notyTimeOutInSecs} seconds (click to dismiss)</strong>`
    }

    noty({
      layout: 'top',
      theme: 'metroui',
      text: notyText,
      type: 'warning',
      timeout: notyTimeOutInSecs * 1000,
      progressBar: showProgressBar
    })
  }
}

function storeCurrentScrollPosition () {
  previousScrollPosition = document.documentElement.scrollTop || document.body.scrollTop
}
