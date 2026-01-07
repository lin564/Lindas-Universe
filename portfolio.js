// Portfolio Gallery Modal Functionality

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    
    // Modal elements
    const modal = document.getElementById('imageModal');
    const modalClose = document.querySelector('.modal-close');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    
    // Gallery items
    const galleryItems = document.querySelectorAll('.gallery-item');
    let currentIndex = 0;
    
    // Project data (customize this for each project)
    const projects = [
        {
            title: 'Math Learning App',
            category: 'Mobile Application',
            description: 'An interactive math learning application designed for elementary students. Features gamified lessons, real-time progress tracking, and adaptive difficulty levels that adjust to each student\'s pace. Built with React Native and Firebase.',
            features: [
                'Personalized learning paths based on student performance',
                'Gamification elements including rewards and achievements',
                'Parent dashboard for monitoring progress',
                'Offline mode for learning anywhere'
            ],
            impact: 'Reached 50,000+ students across 15 countries. Average improvement of 23% in math test scores after 3 months of use. 4.7 star rating on app stores.',
            tags: ['Mobile', 'React Native', 'Education', 'K-12']
        },
        {
            title: 'Teacher Dashboard Platform',
            category: 'Web Platform',
            description: 'A comprehensive platform for educators to manage classrooms, create assignments, track student progress, and facilitate online discussions. Integrates with major LMS systems and provides powerful analytics.',
            features: [
                'Assignment creation and automatic grading',
                'Real-time student progress analytics',
                'Integration with Google Classroom and Canvas',
                'Collaborative lesson planning tools'
            ],
            impact: 'Used by 10,000+ teachers managing 300,000+ students. Reduced grading time by 40% on average. Teachers report 35% increase in student engagement.',
            tags: ['Web Platform', 'EdTech', 'Teacher Tools', 'Analytics']
        },
        {
            title: 'Language Learning App',
            category: 'iOS & Android',
            description: 'Mobile application for learning new languages through immersive, bite-sized lessons. Uses spaced repetition and AI-powered speech recognition to help users achieve fluency faster.',
            features: [
                'AI-powered pronunciation feedback',
                'Spaced repetition algorithm for optimal retention',
                'Real conversation practice with native speakers',
                'Progress tracking and personalized recommendations'
            ],
            impact: '2 million+ downloads worldwide. Users achieve conversational fluency 30% faster than traditional methods. 85% daily active user retention rate.',
            tags: ['Mobile App', 'AI', 'Language Learning', 'Speech Recognition']
        },
        {
            title: 'Assessment Builder Tool',
            category: 'Educational Tool',
            description: 'A powerful tool for educators to create custom assessments with various question types, automatic grading, and detailed analytics. Supports formative and summative assessments with built-in accessibility features.',
            features: [
                'Multiple question types (MC, essay, matching, etc.)',
                'Automatic grading with detailed feedback',
                'Item analysis and learning analytics',
                'WCAG compliant for accessibility'
            ],
            impact: '50,000+ assessments created. Used by 5,000+ educators across higher education and K-12. Saved teachers an average of 5 hours per week on assessment creation and grading.',
            tags: ['Assessment', 'Web Tool', 'Education', 'Accessibility']
        },
        {
            title: 'Learning Management System',
            category: 'Enterprise Platform',
            description: 'Enterprise-grade learning management system designed for corporate training and professional development. Features course authoring, compliance tracking, and advanced reporting capabilities.',
            features: [
                'SCORM and xAPI compliant',
                'Custom course authoring tools',
                'Automated compliance and certification tracking',
                'Advanced reporting and analytics dashboard'
            ],
            impact: 'Deployed across 50+ enterprise clients serving 100,000+ employees. 95% course completion rate. 40% reduction in training costs for organizations.',
            tags: ['LMS', 'Enterprise', 'Corporate Training', 'Compliance']
        },
        {
            title: 'STEM Learning Game',
            category: 'Educational Game',
            description: 'An immersive educational game that teaches STEM concepts through problem-solving challenges and interactive simulations. Designed for middle school students to explore science, technology, engineering, and math in an engaging environment.',
            features: [
                '30+ levels covering physics, chemistry, and engineering',
                'Real-time physics simulations',
                'Multiplayer collaborative challenges',
                'Curriculum-aligned learning objectives'
            ],
            impact: 'Downloaded 500,000+ times. Students show 45% better understanding of complex STEM concepts. Winner of 3 EdTech innovation awards.',
            tags: ['Game-Based Learning', 'STEM', 'Middle School', 'Simulation']
        },
        {
            title: 'Interactive Whiteboard',
            category: 'Collaboration Tool',
            description: 'Real-time collaborative whiteboard for virtual classrooms and remote learning. Enables teachers and students to brainstorm, draw, and work together on visual problems in real-time.',
            features: [
                'Real-time collaboration with up to 50 users',
                'Drawing tools, shapes, and mathematical symbols',
                'Screen recording for lecture capture',
                'Integration with video conferencing platforms'
            ],
            impact: 'Used by 20,000+ classrooms globally. 90% of teachers report improved student engagement in remote lessons. Featured in EdWeek and eSchool News.',
            tags: ['Collaboration', 'Remote Learning', 'Web Tool', 'Real-Time']
        },
        {
            title: 'Learning Analytics Platform',
            category: 'Data Visualization',
            description: 'Comprehensive analytics platform that aggregates data from multiple sources to provide actionable insights on student learning, engagement, and outcomes. Helps institutions make data-driven decisions.',
            features: [
                'Multi-source data integration (LMS, SIS, assessment tools)',
                'Predictive analytics for at-risk student identification',
                'Customizable dashboards and reports',
                'Privacy-compliant data handling'
            ],
            impact: 'Implemented at 30+ institutions serving 200,000+ students. Early intervention programs increased student retention by 18%. Institutions report improved graduation rates.',
            tags: ['Analytics', 'Big Data', 'Higher Ed', 'Predictive']
        },
        {
            title: 'Reading Companion App',
            category: 'Literacy App',
            description: 'AI-powered reading app that helps children develop literacy skills through interactive stories, vocabulary building, and comprehension activities. Adapts to each child\'s reading level.',
            features: [
                'Adaptive reading level adjustment',
                'Interactive vocabulary practice',
                'Comprehension quizzes and activities',
                'Parent progress reports'
            ],
            impact: '300,000+ downloads. Children show 2x improvement in reading fluency after 6 months. Recommended by literacy specialists and educators.',
            tags: ['Literacy', 'Early Education', 'AI', 'Mobile App']
        }
    ];
    
    // Filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            const filter = this.getAttribute('data-filter');
            
            // Filter gallery items
            galleryItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-category') === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
    
    // Open modal when gallery item is clicked
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            currentIndex = index;
            openModal(index);
        });
    });
    
    // Close modal
    modalClose.addEventListener('click', closeModal);
    
    // Close modal when clicking outside content
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!modal.classList.contains('active')) return;
        
        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'ArrowLeft') {
            showPrevious();
        } else if (e.key === 'ArrowRight') {
            showNext();
        }
    });
    
    // Previous/Next buttons
    modalPrev.addEventListener('click', showPrevious);
    modalNext.addEventListener('click', showNext);
    
    // Functions
    function openModal(index) {
        updateModalContent(index);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    function updateModalContent(index) {
        const project = projects[index];
        
        document.getElementById('modalTitle').textContent = project.title;
        document.getElementById('modalCategory').textContent = project.category;
        document.getElementById('modalDescription').textContent = project.description;
        document.getElementById('modalImpact').textContent = project.impact;
        
        // Update features list
        const featuresList = document.getElementById('modalFeatures');
        featuresList.innerHTML = '';
        project.features.forEach(feature => {
            const li = document.createElement('li');
            li.textContent = feature;
            featuresList.appendChild(li);
        });
        
        // Update tags
        const tagsContainer = document.querySelector('.modal-tags');
        tagsContainer.innerHTML = '';
        project.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            tagsContainer.appendChild(span);
        });
    }
    
    function showPrevious() {
        currentIndex = (currentIndex - 1 + projects.length) % projects.length;
        updateModalContent(currentIndex);
    }
    
    function showNext() {
        currentIndex = (currentIndex + 1) % projects.length;
        updateModalContent(currentIndex);
    }
});
