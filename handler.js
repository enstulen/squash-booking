const chromium = require('chrome-aws-lambda')
const puppeteer = require('puppeteer')
const moment = require('moment')

module.exports.bookSquash = async (event, context) => {
  /*   event = {
      username: 'stulenmorten@gmail.com',
      password: 'bQsbvqD5sAN75g2',
      startTime: '09:00',
      halfHoursCount: 2,
      center: 'Sentrum',
      players: ['25634', '25634'],
      payment: false,
    } */

  try {
    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      puppeteer: puppeteer,
    })
    const page = await browser.newPage()
    await page.goto('https://sqf.book247.com/', { waitUntil: 'networkidle0' })

    if (await page.$('#username_focus')) {
      await login(page, event)
    }
    await selectCenter(page, event)
    await clickTomorrow(page)
    await clickTimeSlot(page, event)
    await selectEndTime(page, event)
    await clickNext(page, `a[data-id="to_own_booking"]`)
    await selectBooking(page, event)
    await clickConfirm(page)
    await page.waitForNavigation()
    if (event.payment === true) {
      await makePayment(
        page,
        'body > div.page-container > div > div.page-content-wrapper > div.page-content > div > div > div > div > div.portlet-body > div > div > div.summaray-buttons-bottom > div:nth-child(2) > div > button.btn.btn-success.stripe_peyment'
      )
    }
  } catch (error) {
    console.log(error)
  }

  return context.logStreamName
}

const login = async (page, event) => {
  console.log('Logging in: ', event.username)
  await page.type('#username_focus', event.username)
  await page.type('[placeholder="Password"]', event.password)
  await Promise.all([
    page.click('#user_login_form > div:nth-child(6) > button'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ])
}

const selectCenter = async (page, event) => {
  const centers = {
    Økern: '5',
    Sentrum: '6',
    Sagene: '7',
    Lysaker: '8',
    Bærum: '9',
    Vulkan: '10',
  }
  console.log(`Selected center: ${centers[event.center]} `, event.center)
  await page.select('#resources-list', centers[event.center])
}

const clickTomorrow = async (page) => {
  //Adding 2 days because in the UTC timezone, the clock still hasn't gone past midnight.
  const date = moment().add(2, 'days').format('YYYY-MM-DD')
  console.log('Selecting date: ', date)
  const selector = `input[value="${date}"]`
  await page.evaluate(
    (selector) => document.querySelector(selector).click(),
    selector
  )
}

const clickTimeSlot = async (page, event) => {
  console.log('Selecting timeslot: ', event.startTime)
  const selector = '#booking_hours > a'
  await page.waitFor(2000)
  await page.$$eval(
    selector,
    (anchors, event) => {
      anchors.map((anchor) => {
        if (anchor.textContent.trim() == event.startTime) {
          anchor.click()
          return
        }
      })
    },
    event
  )
}

const selectEndTime = async (page, event) => {
  console.log('Selecting halfHoursCount: ', event.halfHoursCount.toString())
  await page.waitFor(() => !document.querySelector('.blockOverlay'))
  await page.select('#booking_end_time', event.halfHoursCount.toString())
}

const selectBooking = async (page, event) => {
  console.log('selectBooking ')
  for (player in event.players) {
    console.log('Selecting player: ', event.players[player])
    await page.waitFor(5000)
    console.log('Selecting...')
    const playerNumber = parseInt(player)
    if (playerNumber === 0) {
      console.log('Selecting player 0')
      const selector =
        '#booking-step-one > div > div.form-group.note.note-info.is_own_booking > div.booking_step_content > select.form-control.margin-bottom-10.input-sm'
      await page.waitForSelector(selector)
      await page.select(selector, event.players[player])
      await clickNext(
        page,
        `#booking-step-one > div > div.form-group.note.note-info.is_own_booking > div.booking_step_content > div > a.btn.blue-hoki.booking_step_next`
      )
    } else if (playerNumber === 1 && event.players.length === 2) {
      console.log('Selecting player 1 with 2 players')
      const selector =
        '#booking-step-one > div > div.form-group.note.note-info.friend_booking > div.booking_step_content > select.form-control.margin-bottom-10.input-sm'
      await page.waitForSelector(selector)
      await page.select(selector, event.players[player])
      await clickNext(
        page,
        `#booking-step-one > div > div.form-group.note.note-info.friend_booking > div.booking_step_content > div > a.btn.blue-hoki.booking_step_next`
      )
    } else {
      console.log('Selecting next player', playerNumber)
      const selector = `#booking-step-one > div > div:nth-child(${
        playerNumber + 2
      }) > div.booking_step_content > select.form-control.margin-bottom-10.input-sm`
      await page.waitForSelector(selector)
      await page.select(selector, event.players[player])
      await clickNext(
        page,
        `#booking-step-one > div > div:nth-child(${
          playerNumber + 2
        }) > div.booking_step_content > div > a.btn.blue-hoki.booking_step_next`
      )
    }
  }
}

const clickButton = async (page, selector) => {
  await page.evaluate(
    (selector) => document.querySelector(selector).click(),
    selector
  )
}

const clickNext = async (page, selector) => {
  console.log('Clicked next')
  await clickButton(page, selector)
}

const makePayment = async (page, selector) => {
  console.log('Clicked payment')
  await clickButton(page, selector)
  await page.waitFor(3000)
  console.log('Clicked payment modal')
  const yesButtonSelector = `button[data-target="#confirm-modal"]`
  await clickButton(page, yesButtonSelector)
  await page.waitFor(3000)
  console.log('Clicked yes')
  const confirmButtonSelector = '#confirm-stripe'
  await clickButton(page, confirmButtonSelector)
  await page.waitFor(3000)

  console.log('Clicked confirm payment')
}

const clickConfirm = async (page) => {
  console.log('Clicked confirm')
  const selector = `#booking-step-one > div > div.form-group.note.note-info.booking_summary_box > div > div.form-actions.right > a`
  await page.waitFor(5000)
  await page.$$eval(selector, (anchors) => {
    anchors.map((anchor) => {
      if (anchor.textContent.trim() == 'Confirm') {
        anchor.click()
        console.log('Done confirm')
        return
      }
    })
  })
}
