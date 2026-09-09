export const NavbarManager = {
    updateUI(activeViewName) {
        const steps = document.querySelectorAll('.step');
        const progressLine = document.getElementById('progressLine');
        let activeIndex = 0;
        let activeFound = false;

        steps.forEach((step, index) => {
            const view = step.getAttribute('data-view');
            step.classList.remove('active', 'completed');

            if (view === activeViewName) {
                step.classList.add('active');
                activeIndex = index;
                activeFound = true;
            } else if (!activeFound) {
                step.classList.add('completed');
            }
        });

        if (progressLine && steps.length > 1) {
            const percentage = (activeIndex / (steps.length - 1)) * 80;
            progressLine.style.width = `${percentage}%`;
        }
    },

    initEvents(onViewChange) {
        document.addEventListener('click', (e) => {
            const stepElement = e.target.closest('.step');
            if (stepElement) {
                const viewName = stepElement.getAttribute('data-view');
                if (viewName && typeof onViewChange === 'function') {
                    onViewChange(viewName);
                }
            }
        });
    }
};