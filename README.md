# 🎨 EdTech Entrepreneur Portfolio

A modern, artistic portfolio website template designed for educational entrepreneurs, EdTech founders, and learning innovation leaders. Features an interactive image gallery with modal lightbox functionality.

## ✨ Key Features

- 🖼️ **Interactive Portfolio Gallery** - Clickable image grid with beautiful modal/lightbox view
- 🎨 **Bold, Artistic Design** - Vibrant color palette and modern aesthetics
- 📱 **Fully Responsive** - Perfect on all devices
- 🔄 **Portfolio Filtering** - Filter projects by category (Apps, Platforms, Tools)
- ⌨️ **Keyboard Navigation** - Arrow keys and ESC to navigate modal
- 🎯 **Entrepreneur-Focused** - Designed for showcasing educational ventures
- 💫 **Smooth Animations** - Floating shapes and transitions

## 🎨 Color Palette

This template uses a vibrant, professional color scheme perfect for creative entrepreneurs:
- **Rust Brown (#942300)** - Warm, grounded accent
- **Blazing Flame (#FF3B0A)** - Primary CTA color for energy
- **Deep Space Blue (#002642)** - Professional, trustworthy secondary
- **Mint Cream (#f1fffа)** - Fresh, light backgrounds
- **Wisteria Blue (#86a5d9)** - Soft, approachable accent
- **Sky Surge (#5bc0eb)** - Bright, optimistic highlights

## 📁 File Structure

```
edtech-portfolio/
├── index.html          # Home page with hero and impact sections
├── about.html         # About page with story and philosophy
├── portfolio.html     # Interactive portfolio gallery
├── contact.html       # Contact form and opportunities
├── styles.css         # Complete modern styling
├── portfolio.js       # Gallery modal functionality
└── README.md         # This file
```

## 🖼️ Portfolio Gallery Feature

The standout feature is the **interactive portfolio gallery**:

### How It Works
1. **Gallery Grid** - Projects displayed in a responsive grid
2. **Category Filters** - Filter by Apps, Platforms, Tools, or view All
3. **Click to View** - Click any project to open in modal lightbox
4. **Detailed View** - See full project details, features, and impact
5. **Navigation** - Use arrow buttons or keyboard to browse projects
6. **Close Anytime** - Click X, press ESC, or click outside

### Customizing Projects

Edit `portfolio.js` to add your own projects:

```javascript
const projects = [
    {
        title: 'Your Project Name',
        category: 'Project Type',
        description: 'Full project description...',
        features: [
            'Feature 1',
            'Feature 2',
            'Feature 3'
        ],
        impact: 'Impact metrics and results...',
        tags: ['Tag1', 'Tag2', 'Tag3']
    },
    // Add more projects...
];
```

## 🚀 Quick Start

### 1. Customize Content

**Update All Pages:**
- Replace "Your Name" throughout all files
- Update hero section with your mission
- Fill in About page with your story
- Add your contact information
- Customize philosophy and expertise sections

**Customize Portfolio:**
- Add your project images to an `images` folder
- Update `portfolio.html` with your project titles
- Edit `portfolio.js` with detailed project information
- Update category filters if needed

### 2. Add Images

1. Create an `images` folder in your project
2. Add project screenshots/mockups
3. Replace placeholder divs in HTML:
   ```html
   <div class="gallery-image">
       <img src="images/project1.jpg" alt="Project Name">
       <!-- Remove the placeholder div -->
   </div>
   ```

### 3. Personalize Colors (Optional)

Edit `styles.css` (lines 8-13):
```css
:root {
    --rust-brown: #942300;
    --blazing-flame: #FF3B0A;
    --deep-space-blue: #002642;
    --mint-cream: #f1fffа;
    --wisteria-blue: #86a5d9;
    --sky-surge: #5bc0eb;
}
```

## 🌐 Deploying to GitHub Pages

### Personal Site (username.github.io)
1. Create repository: `your-username.github.io`
2. Upload all files
3. Site automatically available at: `https://your-username.github.io`

### Project Site
1. Create any repository (e.g., `portfolio`)
2. Upload files
3. Settings → Pages → Select main branch
4. Site at: `https://your-username.github.io/portfolio`

## 📧 Making Contact Form Work

The contact form needs a backend service:

### Formspree (Recommended)
1. Sign up at [formspree.io](https://formspree.io)
2. Create new form
3. In `contact.html`, update form action:
   ```html
   <form class="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```

## 💡 Tips for EdTech Entrepreneurs

### Portfolio Best Practices

**Tell Compelling Stories:**
- Focus on the problem you solved
- Highlight measurable impact (users, outcomes, engagement)
- Include both qualitative and quantitative results
- Show your unique approach or innovation

**Showcase Diverse Work:**
- Mobile apps
- Web platforms
- Learning tools
- Content or curriculum
- Research or thought leadership

**Include Context:**
- Target audience (K-12, higher ed, corporate, etc.)
- Technologies used
- Your specific role
- Collaborators or partnerships

### Writing Project Descriptions

For each project in `portfolio.js`, include:
1. **Clear Problem Statement** - What challenge did you address?
2. **Your Solution** - How did your product solve it?
3. **Key Features** - What makes it special or innovative?
4. **Impact Metrics** - Users reached, outcomes achieved, recognition
5. **Technology Stack** - Tools and platforms used

### Adding More Projects

To add more than 9 projects:

1. **Add HTML in portfolio.html:**
```html
<div class="gallery-item" data-category="apps" data-id="10">
    <div class="gallery-image">
        <div class="image-placeholder">Project 10</div>
        <div class="gallery-overlay">
            <div class="overlay-content">
                <h3>New Project Name</h3>
                <p>Category</p>
                <span class="view-icon">👁️ Click to View</span>
            </div>
        </div>
    </div>
</div>
```

2. **Add to projects array in portfolio.js:**
```javascript
{
    title: 'New Project',
    category: 'Category',
    description: '...',
    features: [...],
    impact: '...',
    tags: [...]
}
```

## 🎯 Perfect For

- **EdTech Founders** - Showcase your educational ventures
- **Educational Entrepreneurs** - Highlight your innovative products
- **Learning Designers** - Display your portfolio of work
- **Product Managers** - Demonstrate your EdTech projects
- **Consultants** - Present your client work and impact
- **Investors** - Show your portfolio companies

## 🛠️ Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Grid, Flexbox, CSS Variables, Animations
- **JavaScript** - Modal functionality, filtering, keyboard navigation
- **Google Fonts** - Lora & Inter (fallbacks for Le Monde Livre & Acumin Pro)

## 📱 Browser Support

✅ Chrome/Edge (latest)  
✅ Firefox (latest)  
✅ Safari (latest)  
✅ Mobile browsers

## ⌨️ Keyboard Shortcuts

When modal is open:
- **ESC** - Close modal
- **← Left Arrow** - Previous project
- **→ Right Arrow** - Next project

## 🎨 Customization Ideas

### Adding Video to Portfolio
Replace image placeholder with video embed:
```html
<div class="modal-image-container">
    <iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
            frameborder="0" 
            allowfullscreen>
    </iframe>
</div>
```

### Adding More Categories
1. Update filter buttons in `portfolio.html`
2. Add `data-category` to gallery items
3. Update filter logic in `portfolio.js` if needed

### Adding External Links
In project data, add:
```javascript
liveUrl: 'https://yourapp.com',
caseStudyUrl: 'https://medium.com/your-case-study'
```

Then update modal links to use these URLs.

## 📚 Additional Resources

### Typography
- If you have Le Monde Livre and Acumin Pro licenses, add them to a `/fonts` folder
- Update `@font-face` rules in CSS
- Current fallbacks (Lora & Inter) are excellent alternatives

### Design Inspiration
- [Awwwards](https://awwwards.com) - Portfolio design inspiration
- [Behance](https://behance.net) - Creative portfolios
- [Dribbble](https://dribbble.com) - UI/UX inspiration

### EdTech Resources
- [EdSurge](https://edsurge.com) - EdTech news and trends
- [Getting Smart](https://gettingsmart.com) - Education innovation
- [EdTech Hub](https://edtechhub.org) - Research and evidence

## 🤝 Contributing

Improvements welcome! Feel free to:
- Fork this repository
- Create enhancements
- Submit pull requests

## 📄 License

Free to use for personal and commercial projects. Attribution appreciated but not required.

## ⭐ Show Your Support

If you use this template:
- Star this repository
- Share with fellow entrepreneurs
- Tag your live site!

## 💬 Questions?

Open an issue or reach out to the community for help.

---

**Built for educational entrepreneurs changing the world through learning innovation** 🚀

*Make learning better for everyone* ✨
