package test.gcube.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 화면 3개와 정적 자원이 연결되어 있는지. (요구사항 4)
 *
 * <p>MockMvc 는 forward 를 실제로 실행하지 않고 대상 주소만 기록하므로,
 * 짧은 주소는 forward 대상으로, 실제 파일은 직접 요청해 확인한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PageRoutingTest {

    @Autowired
    MockMvc mvc;

    @Test
    @DisplayName("짧은 주소가 각 화면 파일로 연결된다")
    void shortUrlsForwardToPages() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk()).andExpect(forwardedUrl("/items.html"));
        mvc.perform(get("/items")).andExpect(status().isOk()).andExpect(forwardedUrl("/items.html"));
        mvc.perform(get("/orders")).andExpect(status().isOk()).andExpect(forwardedUrl("/orders.html"));
        mvc.perform(get("/schedules")).andExpect(status().isOk())
                .andExpect(forwardedUrl("/schedules.html"));
    }

    @Test
    @DisplayName("화면 파일과 css, js 가 서빙된다")
    void assetsAreServed() throws Exception {
        for (String page : new String[]{"items", "orders", "schedules"}) {
            mvc.perform(get("/" + page + ".html")).andExpect(status().isOk());
        }
        mvc.perform(get("/css/app.css")).andExpect(status().isOk());
        for (String script : new String[]{"app", "items", "orders", "schedules"}) {
            mvc.perform(get("/js/" + script + ".js")).andExpect(status().isOk());
        }
    }
}
