document.addEventListener("DOMContentLoaded", function() {
    const chatBtn = document.getElementById("chat-btn");
    
    chatBtn.addEventListener("click", function() {
        alert("Chat feature is coming soon!");
    });

    // Add smooth scrolling to nav links
    document.querySelectorAll("nav ul li a").forEach(anchor => {
        anchor.addEventListener("click", function(event) {
            event.preventDefault();
            const targetId = this.getAttribute("href").substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 50,
                    behavior: "smooth"
                });
            }
        });
    });
});
