# AgriSolar Solutions Website

A modern, responsive website for an agricultural solar energy company.

## Project Structure

```
agrisolar-website/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── images/
```

## Features

- Responsive design that works on all devices
- Modern and clean UI
- Smooth scrolling navigation
- Mobile-friendly navigation menu
- Contact form
- Social media integration

## Setup

1. Clone this repository
2. Add your images to the `images/` directory:
   - hero-bg.jpg (hero section background)
   - solar-installation.jpg
   - energy-consulting.jpg
   - maintenance.jpg

## Required Images

You'll need to add the following images to the `images` directory:
- hero-bg.jpg: A high-resolution image showing solar panels in an agricultural setting
- solar-installation.jpg: Image showing solar panel installation
- energy-consulting.jpg: Image showing energy consultation
- maintenance.jpg: Image showing maintenance work

## Development

To run this website locally, you can use any local server. For example, using Python:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` in your web browser.

## Customization

- Colors can be modified in the `:root` section of `css/style.css`
- Contact form submission logic can be added in `js/main.js`
- Social media links can be updated in the footer section of `index.html`
