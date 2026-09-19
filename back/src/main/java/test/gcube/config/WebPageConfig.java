package test.gcube.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 화면 라우팅. 정적 HTML 을 짧은 주소로 연결한다.
 * 템플릿 엔진 없이 forward 만 하므로 별도 의존성이 필요 없다.
 */
@Configuration
public class WebPageConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/items.html");
        registry.addViewController("/items").setViewName("forward:/items.html");
        registry.addViewController("/orders").setViewName("forward:/orders.html");
        registry.addViewController("/schedules").setViewName("forward:/schedules.html");
    }
}
